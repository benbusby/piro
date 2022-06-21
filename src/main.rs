mod servos;
mod stream;

use {
    hyper::{
        service::{make_service_fn, service_fn},
        body::HttpBody,
        http::header,
        Body,
        Method,
        StatusCode,
        Request,
        Response,
        Result,
        Server,
    },

    std::process::{Command, ChildStdout, Stdio},
    std::net::SocketAddr,
    std::str,
    tokio::stream::{StreamExt},
    tokio::sync::watch,
};

const HTML: &'static str = "
<head>
    <title>Piro</title>
</head>
<body style='display: block; margin: auto; text-align: center;'>
    <h1>Piro Stream</h1>
    <img src='/stream'><br>
    <span>Use your arrow keys to control the servos!</span>
    <script>
        var xhr = new XMLHttpRequest();
        var url = '/servo';
        var fired = false;
        document.onkeydown = function(event) {
            if (fired) {
                return;
            }

            fired = true;

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = () => {
               if (xhr.readyState === 4 && xhr.status === 200) {
                   console.log('Servo command submitted');
               }
            };

            var data = JSON.stringify({
               left: (event.keyCode || event.which) == '37' ? 1 : 0,
               up: (event.keyCode || event.which) == '38' ? 1 : 0,
               right: (event.keyCode || event.which) == '39' ? 1 : 0,
               down: (event.keyCode || event.which) == '40' ? 1 : 0
            });

            xhr.send(data);
        }

        document.onkeyup = function(event) {
            fired = false;
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = () => {
               if (xhr.readyState === 4 && xhr.status === 200) {
                   console.log('Servo command submitted');
               }
            };

            var data = JSON.stringify({
               left: 0,
               up: 0,
               right: 0,
               down: 0
            });

            xhr.send(data);
        }
    </script>
</body>
";

async fn serve_req(request: Request<Body>, rx: watch::Receiver<Vec<u8>>) -> Result<Response<Body>> {
    match (request.method(), request.uri().path(), request.headers().contains_key(header::UPGRADE)) {
        // HTTP Requests
        (&Method::GET, "/", false) => home_page(),
        (&Method::GET, "/stream", false) => stream_response(rx),
        (&Method::POST, "/servo", false) => {
            let bytes: Vec<u8> = request.into_body().data().await.unwrap().unwrap().to_vec();
            let s = String::from_utf8(bytes).expect("Found invalid UTF-8");
            servos::servo_control(&s);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(Body::from("<h1>OK</h1>"))
                .unwrap())
        },
        // TODO: Websocket servo requests
        _ => { // 404 for everything else
            Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(Body::from("<h1>Not found</h1>"))
                .unwrap())
        }
    }
}

fn home_page() -> Result<Response<Body>> {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/html; charset=UTF-8")
        .body(Body::from(HTML))
        .unwrap())
}

fn stream_response(rx: watch::Receiver<Vec<u8>>) -> Result<Response<Body>> {
    let result_stream = rx.map(|buffer| Result::Ok(buffer));
    let body = Body::wrap_stream(result_stream);
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "multipart/x-mixed-replace; boundary=--FRAME")
        .body(body)
        .unwrap())
}

async fn run_server(addr: SocketAddr, rx: watch::Receiver<Vec<u8>>) {
    println!("Listening on http://{}", addr);
    // Bind the Hyper HTTP server to addr and start serving requests.
    let serve_future = Server::bind(&addr)
        .serve(make_service_fn(|_| {
            // This function is invoked on every request.
            // We need to clone rx to avoid moving it to this request.
            let my_rx = rx.clone();
            async {
                // We need to clone my_rx because of the async block.
                Ok::<_, hyper::Error>(service_fn(move |_req| serve_req(_req, my_rx.clone() )))
            }
        }));

    if let Err(e) = serve_future.await {
        eprintln!("Server error: {}", e);
    }
}

#[tokio::main]
async fn main() {
    let addr = SocketAddr::from(([0, 0, 0, 0], 5000));

    // raspivid -ISO 0 -t 0 -n -o - -w 640 -h 480 -fps 90 -b 25000000 -cd MJPEG -hf -vf

    let mut child = Command::new("raspivid")
        .arg("-n")               // Skip preview
        .args(&["-t", "0"])      // No timeout
        .args(&["-o", "-"])      // Output to stdout
        .args(&["-w", "640"])    // Width
        .args(&["-h", "480"])    // Height
        .args(&["-fps", "90"])   // Frames per second
        .args(&["-cd", "MJPEG"]) // Output type
        .args(&["-ISO", "0"])    // ISO
        .arg("-hf")              // Horizontal flip
        .arg("-vf")              // Vertical flip
        .args(&["-b", "25000000"])  // ??
        .stdout(Stdio::piped())
        .spawn().unwrap();

    let stdout: ChildStdout = child.stdout.take().unwrap();

    // Single-sender, multiple-receiver tokio::watch channel for sending JPEGs
    // read from stdin to HTTP response streams
    let (tx, rx) = watch::channel(Vec::new());

    // Create the Hyper HTTP server and give it the receiving end of the watch channel
    let server = run_server(addr, rx);
    tokio::spawn(async move {
        server.await;
    });

    // Read piped mjpeg stream from raspivid
    stream::stdin_send_loop(tx, stdout);
}

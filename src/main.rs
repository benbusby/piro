mod servos;
mod stream;

use {
    hyper::{
        service::{make_service_fn, service_fn},
        http::header,
        Body,
        StatusCode,
        Request,
        Response,
        Result,
        Server,
    },

    std::net::SocketAddr,
    std::io::{Read, BufRead},
    tokio::stream::{StreamExt},
    tokio::sync::watch,
};

async fn serve_req(request: Request<Body>, rx: watch::Receiver<Vec<u8>>) -> Result<Response<Body>> {
    match (request.uri().path(), request.headers().contains_key(header::UPGRADE)) {
        // HTTP Requests
        ("/", false) => home_page(),
        ("/stream", false) => stream_response(rx),
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
        .body(Body::from("<h1>Stream test</h1><img src='/stream'>"))
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

    // Single-sender, multiple-receiver tokio::watch channel for sending JPEGs
    // read from stdin to HTTP response streams
    let (tx, rx) = watch::channel(Vec::new());

    // Create the Hyper HTTP server and give it the receiving end of the watch channel
    let server = run_server(addr, rx);
    tokio::spawn(async move {
        server.await;
    });

    // Read piped mjpeg stream from raspivid
    stream::stdin_send_loop(tx);
}

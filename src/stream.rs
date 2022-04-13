use {
    tokio::sync::watch,
    std::process::ChildStdout,
    std::io::{BufRead, Read},
};

const HEAD: &[u8] = "\r\n--FRAME\r\nContent-Type: image/jpeg\r\nContent-Length: ".as_bytes();
const RNRN: &[u8] = "\r\n\r\n".as_bytes();

fn send_jpeg(tx: &watch::Sender<Vec<u8>>, output_buffer: &mut Vec<u8>, jpeg: &Vec<u8>) {
    output_buffer.clear();
    // Write the MJPEG header to the output_buffer, followed by the JPEG data.
    output_buffer.extend_from_slice(&HEAD);
    output_buffer.extend_from_slice(&jpeg.len().to_string().as_bytes());
    output_buffer.extend_from_slice(&RNRN);
    output_buffer.extend_from_slice(&jpeg.as_slice());

    // Send the output_buffer to all the open client responses.
    match tx.broadcast(output_buffer.clone()) {
        _ => ()
    }
}

pub fn stdin_send_loop(tx: watch::Sender<Vec<u8>>, stdout: ChildStdout) {
    let mut reader = std::io::BufReader::with_capacity(4096, stdout); // Buffered reader for stdin.
    let mut output_buffer = Vec::with_capacity(65500); // Output buffer, contains MJPEG headers and JPEG data.
    let mut jpeg = Vec::with_capacity(65500); // Read buffer, contains JPEG data read from stdin.

    // Utility buffers for reading JPEG data.
    let mut len_buf = vec![0; 2];
    let mut data_buf = vec![0; 0];
    let mut byt = vec![0; 1];

    // Read JPEGs from stdin and broadcast them to connected clients.
    loop {
        jpeg.clear();
        let mut in_jpeg = false;

        // Does this block the tokio event loop in a bad way? That is, does this prevent clients from receiving data?
        // The async IO version is more CPU-heavy, which is why this is using sync IO.

        while !in_jpeg {
            // Read until the next potential image start marker. This strips out the MJPEG headers in raspivid output.
            in_jpeg = match reader.read_until(0xFF, &mut jpeg) {
                Ok(0) => { panic!("EOF") },
                // JPEG starts with 0xFF 0xD8 0xFF.
                Ok(_n) => jpeg.len() > 2 && jpeg[jpeg.len()-3] == 0xFF && jpeg[jpeg.len()-2] == 0xD8,
                Err(error) => { panic!("IO error: {}", error) },
            };
        }
        // Keep the last three bytes of jpeg, making jpeg == 0xFF 0xD8 0xFF.
        jpeg = jpeg[jpeg.len()-3..].to_vec();

        // Read the rest of the JPEG image data, block by block.
        let mut valid_jpeg = true;
        let mut inside_scan = false;
        loop {
            // Get the marker byte.
            reader.read_exact(&mut byt).unwrap();
            let b = byt[0];
            jpeg.push(b);

            if b == 0xD9 { // End of image marker.
                break;
            } else if b == 0x00 || (b >= 0xD0 && b <= 0xD7) { // Escaped 0xFF or scan reset marker.
                if !inside_scan {
                    println!("0xFF escape or scan reset outside scan data {}", b);
                    valid_jpeg = false;
                    break;
                }
                // Find the next marker.
                reader.read_until(0xFF, &mut jpeg).unwrap();
            } else if b >= 0xC0 && b <= 0xFE { // Marker with length. Read the length and the content.
                inside_scan = b == 0xDA; // Start of Scan.
                reader.read_exact(&mut len_buf).unwrap();
                let len:usize = (len_buf[0] as usize * 256) + (len_buf[1] as usize) - 2;
                jpeg.extend_from_slice(&len_buf.as_slice());
                data_buf.resize(len+1, 0);
                reader.read_exact(&mut data_buf).unwrap();
                jpeg.extend_from_slice(&data_buf.as_slice());
                let end = data_buf[len];
                if end != 0xFF { // Markers must be followed by markers.
                    if inside_scan { // Unless we are inside compressed image data.
                        reader.read_until(0xFF, &mut jpeg).unwrap();
                    } else {
                        println!("Marker not followed by marker {}", end);
                        valid_jpeg = false;
                        break;
                    }
                }
            } else { // Invalid marker.
                println!("Invalid marker {}", b);
                valid_jpeg = false;
                break;
            }
        }

        // Send valid JPEGs to clients.
        if valid_jpeg {
            send_jpeg(&tx, &mut output_buffer, &jpeg);
        }
    }
}

use {
    std::{
        env,
        process::Command,
    },
    serde::{
        Deserialize,
        Serialize
    }
};

// A struct to mirror user keydown/keyup events
#[derive(Serialize, Deserialize)]
struct ServoCommand {
    left: u16,
    down: u16,
    up: u16,
    right: u16
}

// PWM values
const CW: u16 = 1000;
const CCW: u16 = 2000;
const STOP: u16 = 0;

/// Parses json servo commands from the websocket connection, and interprets them
/// for the pi gpio daemon.
///
/// # Arguments
/// * `data` - the raw (json) string sent by the user. If a key is pressed, it will
///            be sent as a 1, otherwise it will be a 0
pub fn servo_control(data: &str) {
    let command: ServoCommand = serde_json::from_str(data).unwrap();

    if command.left != 0 || command.right != 0 {
        send_command(command.left * CW, command.right * CCW);
    } else if command.up != 0 || command.down != 0 {
        send_command(
            if command.up != 0 { CCW } else { CW },
            if command.up != 0 { CW } else { CCW }
        )
    } else {
        send_command(STOP, STOP)
    }
}

/// Sends the PWM value for the servo to "pigs" (pi gpio daemon must be running).
///
/// Note: This is assuming a mirrored motor setup for either side of the vehicle, meaning one side
/// should turn clockwise and the other should turn counterclockwise to move forward, and the
/// opposite for reversing. Turning is accomplished by moving the opposite wheel (turning left
/// moves the right wheel and uses the left wheel as a pivot, and vice versa).
///
/// # Arguments
/// * `l_val` - the PWM value for the "left" servo
/// * `r_val` - the PWM value for the "right" servo
fn send_command(l_val: u16, r_val: u16) {
    let servo_l: &str = &*env::var("SERVO_L").unwrap_or("17".to_string());
    let servo_r: &str = &*env::var("SERVO_R").unwrap_or("22".to_string());

    Command::new("pigs")
        .args(&["SERVO", servo_l, &l_val.to_string()])
        .args(&["SERVO", servo_r, &r_val.to_string()])
        .output()
        .expect("Failed to execute servo command");
}

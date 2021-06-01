use {
    std::{
        env,
        process::Command,
    }
};

// PWM values
const CW: &str = "1000";
const CCW: &str = "2000";
const STOP: &str = "0";

fn servo_control(left: bool, right: bool) {
    // Servo pin #s
    // TODO: Unfinished, needs refactoring
    let servo_l: &str = &*env::var("servo_l").unwrap_or("17".to_string());
    let servo_r: &str = &*env::var("servo_r").unwrap_or("27".to_string());

    Command::new("pigs")
        .args(&["SERVO", servo_l, if left { CW } else { STOP }])
        .args(&["SERVO", servo_r, if right { CCW } else { STOP }])
        .output();
}
//! Kiểm định toàn bộ kho dữ liệu nhúng sẵn (logic chi tiết ở `bovabon_edu::verify`).

use bovabon_edu::bank::Bank;
use bovabon_edu::verify::{Options, verify_tracks};

#[test]
fn embedded_bank_is_valid() {
    let b = Bank::load().expect("kho dữ liệu hợp lệ");
    assert!(b.tracks.len() >= 19, "thiếu lộ trình: {}", b.tracks.len());
    let tracks: Vec<_> = b.tracks.iter().collect();
    let errs = verify_tracks(&tracks, &Options { jobs: 6, ..Options::default() });
    assert!(errs.is_empty(), "\n{}", errs.join("\n"));
}

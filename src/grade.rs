//! Chấm điểm phía server cho trắc nghiệm, điền khuyết, tự luận ngắn.

use crate::bank::{QType, Question, md};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct CheckResult {
    pub correct: bool,
    /// 0.0 – 1.0 (điểm từng phần)
    pub score: f64,
    pub explanation_html: String,
    /// single/multiple: chỉ số đáp án đúng
    pub correct_options: Vec<usize>,
    /// fill: đúng/sai từng ô + đáp án chuẩn
    pub blank_results: Vec<bool>,
    pub blank_answers: Vec<String>,
    /// essay: nhóm từ khoá đã khớp / còn thiếu + đáp án mẫu
    pub matched_keywords: Vec<String>,
    pub missing_keywords: Vec<String>,
    pub model_answer_html: String,
}

/// Chuẩn hoá đáp án điền: bỏ khoảng trắng, chữ thường, bỏ dấu ; và ngoặc kép bao ngoài.
pub fn normalize(s: &str) -> String {
    let mut t: String = s.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();
    while t.ends_with(';') {
        t.pop();
    }
    for q in ['\'', '"', '`'] {
        if t.len() >= 2 && t.starts_with(q) && t.ends_with(q) {
            t = t[1..t.len() - 1].to_string();
        }
    }
    t
}

fn to_indices(v: &Value) -> Vec<usize> {
    match v {
        Value::Array(a) => a.iter().filter_map(|x| x.as_u64().map(|n| n as usize)).collect(),
        Value::Number(n) => n.as_u64().map(|n| vec![n as usize]).unwrap_or_default(),
        _ => vec![],
    }
}

fn base(q: &Question) -> CheckResult {
    CheckResult {
        correct: false,
        score: 0.0,
        explanation_html: md(&q.explanation),
        correct_options: vec![],
        blank_results: vec![],
        blank_answers: vec![],
        matched_keywords: vec![],
        missing_keywords: vec![],
        model_answer_html: String::new(),
    }
}

pub fn check(q: &Question, answer: &Value) -> CheckResult {
    let mut r = base(q);
    match q.qtype {
        QType::Single | QType::Multiple => {
            let mut given = to_indices(answer);
            given.sort_unstable();
            given.dedup();
            let mut exp = q.answer.clone();
            exp.sort_unstable();
            r.correct_options = exp.clone();
            r.correct = given == exp;
            if q.qtype == QType::Multiple && !r.correct {
                // điểm từng phần: đúng - sai, tối thiểu 0
                let hit = given.iter().filter(|g| exp.contains(g)).count() as f64;
                let wrong = given.iter().filter(|g| !exp.contains(g)).count() as f64;
                r.score = ((hit - wrong) / exp.len() as f64).max(0.0);
            } else {
                r.score = if r.correct { 1.0 } else { 0.0 };
            }
        }
        QType::Fill => {
            let given: Vec<String> = match answer {
                Value::Array(a) => a.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect(),
                Value::String(s) => vec![s.clone()],
                _ => vec![],
            };
            let mut used: Vec<String> = Vec::new();
            for (i, accepted) in q.blanks.iter().enumerate() {
                let g = normalize(given.get(i).map(String::as_str).unwrap_or(""));
                let dup = q.unique_blanks && used.contains(&g);
                used.push(g.clone());
                let ok = !g.is_empty() && !dup && accepted.iter().any(|a| normalize(a) == g);
                r.blank_results.push(ok);
                r.blank_answers.push(accepted[0].clone());
            }
            let ok = r.blank_results.iter().filter(|b| **b).count();
            r.score = ok as f64 / q.blanks.len().max(1) as f64;
            r.correct = ok == q.blanks.len();
        }
        QType::Essay => {
            let text = answer.as_str().unwrap_or("").to_lowercase();
            for group in &q.keywords {
                let hit = group.iter().any(|k| text.contains(&k.to_lowercase()));
                if hit {
                    r.matched_keywords.push(group[0].clone());
                } else {
                    r.missing_keywords.push(group[0].clone());
                }
            }
            let need = q.min_keywords.unwrap_or(q.keywords.len()).min(q.keywords.len()).max(1);
            r.score = (r.matched_keywords.len() as f64 / need as f64).min(1.0);
            r.correct = r.matched_keywords.len() >= need;
            r.model_answer_html = md(&q.model_answer);
        }
        QType::Code => {
            r.explanation_html = md(&q.explanation);
        }
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn norm() {
        assert_eq!(normalize("  useState ; "), "usestate");
        assert_eq!(normalize("'abc'"), "abc");
        assert_eq!(normalize("a => a + 1"), "a=>a+1");
    }
}

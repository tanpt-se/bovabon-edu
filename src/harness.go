package main

// Bovabon Edu — mini test harness cho Go.
// Test được đăng ký bằng: var _ = Test("mô tả", func(t *T) { ... })
// T hỗ trợ Errorf / Error / Fatalf / Fatal giống *testing.T.

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type T struct {
	failed bool
	msgs   []string
}

type bovabonFatal struct{}

func (t *T) Errorf(format string, a ...any) {
	t.failed = true
	t.msgs = append(t.msgs, fmt.Sprintf(format, a...))
}
func (t *T) Error(a ...any) { t.failed = true; t.msgs = append(t.msgs, fmt.Sprint(a...)) }
func (t *T) Fatalf(format string, a ...any) {
	t.Errorf(format, a...)
	panic(bovabonFatal{})
}
func (t *T) Fatal(a ...any) { t.Error(a...); panic(bovabonFatal{}) }

type bovabonCase struct {
	name string
	fn   func(*T)
}

var bovabonTests []bovabonCase

func Test(name string, fn func(*T)) bool {
	bovabonTests = append(bovabonTests, bovabonCase{name, fn})
	return true
}

type bovabonResult struct {
	Name   string  `json:"name"`
	Passed bool    `json:"passed"`
	Error  *string `json:"error"`
}

func bovabonRun(tc bovabonCase) (r bovabonResult) {
	t := &T{}
	r.Name = tc.name
	defer func() {
		if p := recover(); p != nil {
			if _, ok := p.(bovabonFatal); !ok {
				t.failed = true
				t.msgs = append(t.msgs, fmt.Sprintf("panic: %v", p))
			}
		}
		r.Passed = !t.failed
		if t.failed {
			s := strings.Join(t.msgs, "\n")
			r.Error = &s
		}
	}()
	tc.fn(t)
	return
}

func main() {
	out := []bovabonResult{}
	for _, tc := range bovabonTests {
		out = append(out, bovabonRun(tc))
	}
	b, _ := json.Marshal(map[string]any{"results": out, "logs": []string{}, "pending": 0})
	fmt.Fprintln(os.Stdout, "\n@@BOVABON@@"+string(b))
}

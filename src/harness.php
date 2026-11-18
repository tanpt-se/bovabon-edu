<?php
// Bovabon Edu — mini test harness cho PHP 8 (cú pháp gần với Pest/Jest).
//   test('cộng hai số', function () { expect(add(1, 2))->toBe(3); });
//   expect($x)->not->toBeNull();  expect(fn () => f())->toThrow(InvalidArgumentException::class, 'thông điệp');
error_reporting(E_ALL);
set_error_handler(function (int $no, string $str, string $file = '', int $line = 0) {
    throw new ErrorException($str, 0, $no, $file, $line);
});

final class BovabonAssertionError extends Exception {}

$GLOBALS['__bovabon_tests'] = [];

function test(string $name, callable $fn): void { $GLOBALS['__bovabon_tests'][] = [$name, $fn]; }
function it(string $name, callable $fn): void { test($name, $fn); }

function __bovabon_show(mixed $v): string {
    if ($v instanceof Closure) return 'Closure';
    if (is_object($v)) return get_class($v) . ' ' . json_encode($v, JSON_UNESCAPED_UNICODE);
    return var_export($v, true);
}

final class BovabonExpectation {
    public function __construct(private mixed $value, private bool $negate = false) {}

    public function __get(string $name): self {
        if ($name === 'not') return new self($this->value, !$this->negate);
        throw new Error("Không có thuộc tính expect()->$name");
    }

    private function check(bool $ok, string $msg): self {
        if ($ok === $this->negate) throw new BovabonAssertionError(($this->negate ? 'Không mong đợi: ' : '') . $msg);
        return $this;
    }

    public function toBe(mixed $e): self { return $this->check($this->value === $e, 'Mong đợi ' . __bovabon_show($e) . ', nhận ' . __bovabon_show($this->value)); }
    public function toEqual(mixed $e): self { return $this->check($this->value == $e, 'Mong đợi bằng ' . __bovabon_show($e) . ', nhận ' . __bovabon_show($this->value)); }
    public function toBeTrue(): self { return $this->check($this->value === true, 'Mong đợi true, nhận ' . __bovabon_show($this->value)); }
    public function toBeFalse(): self { return $this->check($this->value === false, 'Mong đợi false, nhận ' . __bovabon_show($this->value)); }
    public function toBeNull(): self { return $this->check($this->value === null, 'Mong đợi null, nhận ' . __bovabon_show($this->value)); }
    public function toBeGreaterThan(int|float $n): self { return $this->check($this->value > $n, __bovabon_show($this->value) . " không lớn hơn $n"); }
    public function toBeLessThan(int|float $n): self { return $this->check($this->value < $n, __bovabon_show($this->value) . " không nhỏ hơn $n"); }
    public function toBeInstanceOf(string $c): self { return $this->check($this->value instanceof $c, 'Không phải instance của ' . $c); }
    public function toHaveCount(int $n): self { return $this->check(count($this->value) === $n, "Mong đợi $n phần tử, có " . count($this->value)); }
    public function toHaveKey(string|int $k): self { return $this->check(is_array($this->value) && array_key_exists($k, $this->value), "Thiếu key $k"); }
    public function toMatch(string $re): self { return $this->check(is_string($this->value) && preg_match($re, $this->value) === 1, __bovabon_show($this->value) . " không khớp $re"); }
    public function toContain(mixed $x): self {
        $ok = is_string($this->value) ? str_contains($this->value, (string) $x) : in_array($x, (array) $this->value, true);
        return $this->check($ok, __bovabon_show($this->value) . ' không chứa ' . __bovabon_show($x));
    }
    public function toThrow(?string $class = null, ?string $message = null): self {
        $thrown = null;
        try { ($this->value)(); } catch (Throwable $t) { $thrown = $t; }
        $ok = $thrown !== null
            && ($class === null || $thrown instanceof $class)
            && ($message === null || str_contains($thrown->getMessage(), $message));
        $got = $thrown ? get_class($thrown) . ': ' . $thrown->getMessage() : 'không ném lỗi';
        return $this->check($ok, 'Mong đợi ném ' . ($class ?? 'exception') . ($message ? " \"$message\"" : '') . ", nhận $got");
    }
}

function expect(mixed $value): BovabonExpectation { return new BovabonExpectation($value); }

function __bovabon_run(): void {
    $results = [];
    foreach ($GLOBALS['__bovabon_tests'] as [$name, $fn]) {
        try {
            $fn();
            $results[] = ['name' => $name, 'passed' => true, 'error' => null];
        } catch (Throwable $t) {
            $msg = $t instanceof BovabonAssertionError ? $t->getMessage() : get_class($t) . ': ' . $t->getMessage() . ' (dòng ' . $t->getLine() . ')';
            $results[] = ['name' => $name, 'passed' => false, 'error' => $msg];
        }
    }
    echo "\n@@BOVABON@@" . json_encode(['results' => $results, 'logs' => []], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}

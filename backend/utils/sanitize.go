package utils

import (
	"html"
	"regexp"
	"strings"
)

var (
	// Pola serangan XSS berbahaya
	xssPattern = regexp.MustCompile(`(?i)(<\s*script\b|<\s*/\s*script\s*>|javascript\s*:|vbscript\s*:|data\s*:\s*text/html|on(error|load|click|mouseover|focus|blur|submit|change|keyup|keydown)\s*=|<\s*(iframe|object|embed|applet|meta|link|style|svg|math)\b)`)

	// Pola injeksi SQL / Path Traversal berbahaya pada parameter
	sqliPattern = regexp.MustCompile(`(?i)(\bunion\s+(all\s+)?select\b|\bselect\b.+\bfrom\s+information_schema\b|\bsleep\s*\(\s*\d+\s*\)|\bbenchmark\s*\(|\bdrop\s+table\b|\balter\s+table\b|--\s*$|/\*.*\*/)`)

	// Pola ekstensi ganda berbahaya pada nama file upload (contoh: shell.php.jpg)
	dangerousDoubleExtPattern = regexp.MustCompile(`(?i)\.(php|phtml|phar|pl|py|rb|sh|bash|cgi|jsp|asp|aspx|exe|bat|cmd|ps1|dll|so|html|htm|js|mjs|svg|xml)\.(jpg|jpeg|png|webp)$`)
)

// ContainsXSS mendeteksi apakah string mengandung payload XSS
func ContainsXSS(input string) bool {
	if input == "" {
		return false
	}
	return xssPattern.MatchString(input)
}

// ContainsSQLi mendeteksi apakah string mengandung payload SQL Injection eksplisit
func ContainsSQLi(input string) bool {
	if input == "" {
		return false
	}
	return sqliPattern.MatchString(input)
}

// HasDangerousDoubleExtension memeriksa apakah nama file memiliki ekstensi ganda berbahaya
func HasDangerousDoubleExtension(filename string) bool {
	return dangerousDoubleExtPattern.MatchString(strings.TrimSpace(filename))
}

// SanitizeString membersihkan spasi berlebih, null byte, dan melakukan HTML escaping untuk mencegah XSS
func SanitizeString(s string) string {
	cleaned := strings.ReplaceAll(s, "\x00", "")
	cleaned = strings.TrimSpace(cleaned)
	return html.EscapeString(cleaned)
}

const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = process.env.PORT || 3000;

const APPROVED_FILE = path.join(__dirname, "indexes", "approved.txt");
const INDEX_FILE = path.join(__dirname, "index.html");

/**
 * Check whether a domain is valid.
 *
 * Accepted examples:
 *   github.com
 *   www.github.com
 *   docs.github.com
 *
 * Not accepted:
 *   github
 *   https://github.com/path
 *   javascript:...
 */
function isValidDomain(domain) {
    if (!domain || domain.length > 253) {
        return false;
    }

    // Remove a trailing dot, which is valid DNS syntax.
    domain = domain.replace(/\.$/, "");

    // Domain must contain at least one dot.
    if (!domain.includes(".")) {
        return false;
    }

    // Reject anything containing spaces, slashes, protocols, etc.
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
        return false;
    }

    // Cannot begin or end with a hyphen.
    if (domain.startsWith("-") || domain.endsWith("-")) {
        return false;
    }

    const labels = domain.split(".");

    for (const label of labels) {
        if (
            label.length === 0 ||
            label.length > 63 ||
            label.startsWith("-") ||
            label.endsWith("-") ||
            !/^[a-zA-Z0-9-]+$/.test(label)
        ) {
            return false;
        }
    }

    // TLD must contain only letters.
    const tld = labels[labels.length - 1];

    if (!/^[a-zA-Z]{2,63}$/.test(tld)) {
        return false;
    }

    return true;
}

/**
 * Normalize a line from approved.txt into a canonical URL.
 *
 * Example:
 *   github.com          -> https://github.com
 *   WWW.GITHUB.COM      -> https://www.github.com
 *   https://github.com  -> https://github.com
 */
function normalizeSite(line) {
    let value = line.trim();

    if (!value || value.startsWith("#")) {
        return null;
    }

    // Allow users to accidentally put http:// or https://.
    value = value.replace(/^https?:\/\//i, "");

    // Do not allow paths, query strings, fragments, ports, etc.
    if (value.includes("/") || value.includes("?") || value.includes("#")) {
        return null;
    }

    // Remove trailing dot.
    value = value.replace(/\.$/, "");

    // Normalize capitalization.
    value = value.toLowerCase();

    if (!isValidDomain(value)) {
        return null;
    }

    return `https://${value}`;
}

/**
 * Read and validate approved sites.
 */
function getApprovedSites() {
    if (!fs.existsSync(APPROVED_FILE)) {
        return [];
    }

    const lines = fs
        .readFileSync(APPROVED_FILE, "utf8")
        .split(/\r?\n/);

    const sites = [];
    const seen = new Set();

    for (const line of lines) {
        const site = normalizeSite(line);

        if (!site) {
            continue;
        }

        if (seen.has(site)) {
            continue;
        }

        seen.add(site);
        sites.push(site);
    }

    return sites;
}

/**
 * Send JSON.
 */
function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data, null, 2);

    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": Buffer.byteLength(body)
    });

    res.end(body);
}

/**
 * Send plain text.
 */
function sendText(res, statusCode, text) {
    res.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Content-Length": Buffer.byteLength(text)
    });

    res.end(text);
}

/**
 * Send HTML.
 */
function sendHTML(res, statusCode, html) {
    res.writeHead(statusCode, {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Content-Length": Buffer.byteLength(html)
    });

    res.end(html);
}

const server = http.createServer((req, res) => {
    // CORS preflight.
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });

        res.end();
        return;
    }

    // This index is read-only.
    if (req.method !== "GET") {
        sendJSON(res, 405, {
            error: "Method Not Allowed"
        });

        return;
    }

    const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    if (url.pathname === "/api/sites") {
        const sites = getApprovedSites();

        sendJSON(res, 200, {
            sites,
            count: sites.length
        });

        return;
    }

    /**
     * GET /api/sites.txt
     *
     * Returns one normalized URL per line.
     */
    if (url.pathname === "/api/sites.txt") {
        const sites = getApprovedSites();

        sendText(res, 200, sites.join("\n"));
        return;
    }

    /**
     * GET /api/health
     */
    if (url.pathname === "/api/health") {
        const sites = getApprovedSites();

        sendJSON(res, 200, {
            status: "ok",
            sites: sites.length
        });

        return;
    }

    /**
     * GET /
     * GET /index.html
     */
    if (url.pathname === "/" || url.pathname === "/index.html") {
        if (!fs.existsSync(INDEX_FILE)) {
            sendText(res, 500, "index.html not found");
            return;
        }

        const html = fs.readFileSync(INDEX_FILE, "utf8");

        sendHTML(res, 200, html);
        return;
    }

    // Unknown endpoint.
    sendJSON(res, 404, {
        error: "Not Found"
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Netitera Index running at http://${HOST}:${PORT}`);
});
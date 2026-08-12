/**
 * Netitera Index API
 *
 * GitHub Pages compatible.
 *
 * This file does NOT run a server.
 * Instead, it provides a JavaScript API for reading
 * the Netitera approved-site index.
 *
 * Example:
 *
 * import {
 *     getSites,
 *     isApproved,
 *     getDomains
 * } from "https://netitera.github.io/Index/index.js";
 *
 * const sites = await getSites();
 *
 * console.log(sites);
 *
 * console.log(await isApproved("github.com"));
 */

/*
 * Resolve the index directory from this file itself.
 *
 * This is important because the project is hosted at:
 *
 * https://netitera.github.io/Index/
 *
 * Using import.meta.url means the API still works if
 * the repository/project is moved elsewhere.
 */
const INDEX_ROOT = new URL("./", import.meta.url);

/*
 * Location of the approved-site source file.
 */
const APPROVED_URL = new URL(
    "./indexes/approved.txt",
    INDEX_ROOT
);

/*
 * Normalize a domain into a canonical URL.
 *
 * Examples:
 *
 * github.com
 * https://github.com
 * https://www.github.com/
 *
 * become a normalized representation.
 */
function normalizeDomain(value) {
    if (typeof value !== "string") {
        return null;
    }

    let domain = value.trim();

    if (!domain) {
        return null;
    }

    /*
     * Remove HTTP/HTTPS if supplied.
     */
    domain = domain.replace(
        /^https?:\/\//i,
        ""
    );

    /*
     * Remove a trailing slash.
     */
    domain = domain.replace(/\/+$/, "");

    /*
     * Do not accept paths, queries, or fragments.
     */
    if (
        domain.includes("/") ||
        domain.includes("?") ||
        domain.includes("#")
    ) {
        return null;
    }

    /*
     * Lowercase domain names.
     */
    domain = domain.toLowerCase();

    /*
     * Basic hostname validation.
     */
    const hostnamePattern =
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

    if (!hostnamePattern.test(domain)) {
        return null;
    }

    return domain;
}

/*
 * Convert a raw approved.txt line into a normalized site.
 */
function parseLine(line) {
    let value = line.trim();

    /*
     * Ignore empty lines.
     */
    if (!value) {
        return null;
    }

    /*
     * Ignore comments.
     */
    if (value.startsWith("#")) {
        return null;
    }

    const domain = normalizeDomain(value);

    if (!domain) {
        return null;
    }

    return {
        domain,
        url: `https://${domain}`
    };
}

/**
 * Fetch and parse the approved index.
 *
 * @returns {Promise<Array<{domain: string, url: string}>>}
 */
export async function getSites() {
    const response = await fetch(
        APPROVED_URL,
        {
            method: "GET",
            cache: "no-cache"
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch approved index: HTTP ${response.status}`
        );
    }

    const text = await response.text();

    const sites = [];
    const seen = new Set();

    for (const line of text.split(/\r?\n/)) {
        const site = parseLine(line);

        if (!site) {
            continue;
        }

        /*
         * Prevent duplicate domains.
         */
        if (seen.has(site.domain)) {
            continue;
        }

        seen.add(site.domain);
        sites.push(site);
    }

    return sites;
}

/**
 * Get only the domains.
 *
 * @returns {Promise<string[]>}
 */
export async function getDomains() {
    const sites = await getSites();

    return sites.map(site => site.domain);
}

/**
 * Get only the URLs.
 *
 * @returns {Promise<string[]>}
 */
export async function getURLs() {
    const sites = await getSites();

    return sites.map(site => site.url);
}

/**
 * Check whether a domain is approved.
 *
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function isApproved(domain) {
    const normalized = normalizeDomain(domain);

    if (!normalized) {
        return false;
    }

    const domains = await getDomains();

    return domains.includes(normalized);
}

/**
 * Get the raw location of the Netitera approved index.
 *
 * @returns {string}
 */
export function getIndexURL() {
    return APPROVED_URL.href;
}

/*
 * Also expose the API globally for non-module users.
 *
 * This allows another site to do:
 *
 * <script src="https://netitera.github.io/Index/index.js"></script>
 *
 * and then:
 *
 * NetiteraIndex.getSites()
 *
 * Modern projects should prefer ES modules.
 */
globalThis.NetiteraIndex = {
    getSites,
    getDomains,
    getURLs,
    isApproved,
    getIndexURL
};
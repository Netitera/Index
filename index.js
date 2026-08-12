(function () {
    "use strict";

    /*
     * Netitera Index API
     *
     * This file is served from:
     * https://netitera.github.io/Index/index.js
     *
     * It can be consumed by other GitHub Pages sites.
     */

    const APPROVED_FILE =
        "https://netitera.github.io/Index/indexes/approved.txt";

    function normalizeDomain(value) {
        if (typeof value !== "string") {
            return null;
        }

        let domain = value.trim();

        if (!domain || domain.startsWith("#")) {
            return null;
        }

        domain = domain.replace(/^https?:\/\//i, "");
        domain = domain.replace(/\/+$/, "");
        domain = domain.toLowerCase();

        if (
            domain.includes("/") ||
            domain.includes("?") ||
            domain.includes("#") ||
            domain.includes(":")
        ) {
            return null;
        }

        const validDomain =
            /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

        if (!validDomain.test(domain)) {
            return null;
        }

        return domain;
    }

    async function getSites() {
        const response = await fetch(
            APPROVED_FILE,
            {
                method: "GET",
                cache: "no-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to load approved index: HTTP " +
                response.status
            );
        }

        const text = await response.text();

        const sites = [];
        const seen = new Set();

        for (const line of text.split(/\r?\n/)) {
            const domain = normalizeDomain(line);

            if (!domain || seen.has(domain)) {
                continue;
            }

            seen.add(domain);

            sites.push({
                domain: domain,
                url: "https://" + domain
            });
        }

        return sites;
    }

    async function getDomains() {
        const sites = await getSites();

        return sites.map(function (site) {
            return site.domain;
        });
    }

    async function getURLs() {
        const sites = await getSites();

        return sites.map(function (site) {
            return site.url;
        });
    }

    async function isApproved(domain) {
        const normalized = normalizeDomain(domain);

        if (!normalized) {
            return false;
        }

        const domains = await getDomains();

        return domains.includes(normalized);
    }

    window.NetiteraIndex = {
        getSites: getSites,
        getDomains: getDomains,
        getURLs: getURLs,
        isApproved: isApproved
    };
})();
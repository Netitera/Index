(function () {
    "use strict";

    /*
     * This is a GitHub Pages-compatible client-side API.
     *
     * It reads:
     *
     * https://netitera.github.io/Index/indexes/approved.txt
     *
     * using a normal GET request.
     */

    const APPROVED_FILE = "./indexes/approved.txt";

    /*
     * Convert a domain into a normalized representation.
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
         * Ignore comments.
         */
        if (domain.startsWith("#")) {
            return null;
        }

        /*
         * Allow users to write either:
         *
         * github.com
         * https://github.com
         * http://github.com
         */
        domain = domain.replace(/^https?:\/\//i, "");

        /*
         * Remove trailing slash.
         */
        domain = domain.replace(/\/+$/, "");

        /*
         * Only allow domains.
         * No paths, ports, queries, or fragments.
         */
        if (
            domain.includes("/") ||
            domain.includes("?") ||
            domain.includes("#") ||
            domain.includes(":")
        ) {
            return null;
        }

        domain = domain.toLowerCase();

        /*
         * Basic domain validation.
         */
        const validDomain =
            /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

        if (!validDomain.test(domain)) {
            return null;
        }

        return domain;
    }

    /*
     * Read the approved.txt file.
     */
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
                "HTTP " + response.status + " while requesting " + APPROVED_FILE
            );
        }

        const text = await response.text();

        const sites = [];
        const seen = new Set();

        for (const line of text.split(/\r?\n/)) {
            const domain = normalizeDomain(line);

            if (!domain) {
                continue;
            }

            if (seen.has(domain)) {
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

    /*
     * Check whether a domain is approved.
     */
    async function isApproved(domain) {
        const sites = await getSites();

        const normalized = normalizeDomain(domain);

        if (!normalized) {
            return false;
        }

        return sites.some(function (site) {
            return site.domain === normalized;
        });
    }

    /*
     * Public API.
     *
     * Other websites can load this same JS file and use:
     *
     * NetiteraIndex.getSites()
     * NetiteraIndex.isApproved("github.com")
     */
    window.NetiteraIndex = {
        getSites: getSites,
        isApproved: isApproved,
        getDomains: async function () {
            const sites = await getSites();

            return sites.map(function (site) {
                return site.domain;
            });
        },

        getURLs: async function () {
            const sites = await getSites();

            return sites.map(function (site) {
                return site.url;
            });
        }
    };

    /*
     * Build the visible index page.
     */
    async function renderIndex() {
        const status = document.getElementById("status");
        const siteList = document.getElementById("sites");

        try {
            const sites = await getSites();

            status.textContent =
                sites.length +
                " approved site" +
                (sites.length === 1 ? "" : "s");

            if (sites.length === 0) {
                const item = document.createElement("li");

                item.className = "empty";
                item.textContent = "No approved sites yet.";

                siteList.appendChild(item);

                return;
            }

            for (const site of sites) {
                const item = document.createElement("li");
                const link = document.createElement("a");

                link.href = site.url;
                link.textContent = site.domain;

                link.target = "_blank";
                link.rel = "noopener noreferrer";

                item.appendChild(link);
                siteList.appendChild(item);
            }
        } catch (error) {
            console.error("Netitera Index error:", error);

            status.textContent =
                "Unable to load the approved-site index.";

            status.className = "error";

            const item = document.createElement("li");

            item.className = "error";
            item.textContent =
                "The index could not be loaded. Check that indexes/approved.txt exists.";

            siteList.appendChild(item);
        }
    }

    /*
     * Expose the API first, then render the page.
     */
    renderIndex();
})();
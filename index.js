(function () {
    "use strict";

    /*
     * Netitera Index API
     *
     * Repository:
     * https://netitera.github.io/Index/
     *
     * Approved domains:
     * ./indexes/approved.txt
     *
     * Crawl data:
     * ./crawled/<domain>.json
     */

    const INDEX_ROOT =
        "https://netitera.github.io/Index/";

    const APPROVED_FILE =
        INDEX_ROOT + "indexes/approved.txt";

    const CRAWLED_ROOT =
        INDEX_ROOT + "crawled/";


    /*
     * Normalize a domain.
     */
    function normalizeDomain(value) {
        if (typeof value !== "string") {
            return null;
        }

        let domain = value.trim();

        if (!domain || domain.startsWith("#")) {
            return null;
        }

        domain = domain.replace(
            /^https?:\/\//i,
            ""
        );

        domain = domain
            .split("/")[0]
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();

        if (!domain) {
            return null;
        }

        const validDomain =
            /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

        if (!validDomain.test(domain)) {
            return null;
        }

        return domain;
    }


    /*
     * Get the approved domains.
     */
    async function getDomains() {
        const response = await fetch(
            APPROVED_FILE,
            {
                method: "GET",
                cache: "no-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to load approved.txt: HTTP " +
                response.status
            );
        }

        const text = await response.text();

        const domains = [];
        const seen = new Set();

        for (const line of text.split(/\r?\n/)) {
            const domain =
                normalizeDomain(line);

            if (!domain) {
                continue;
            }

            if (seen.has(domain)) {
                continue;
            }

            seen.add(domain);
            domains.push(domain);
        }

        return domains;
    }


    /*
     * Return approved sites with their URLs.
     */
    async function getSites() {
        const domains =
            await getDomains();

        return domains.map(function (domain) {
            return {
                domain: domain,
                url: "https://" + domain
            };
        });
    }


    /*
     * Get one domain's crawl JSON.
     *
     * Example:
     *
     * getCrawl("github.com")
     *
     * loads:
     *
     * /crawled/github.com.json
     */
    async function getCrawl(domain) {
        const normalized =
            normalizeDomain(domain);

        if (!normalized) {
            throw new Error(
                "Invalid domain: " + domain
            );
        }

        const response = await fetch(
            CRAWLED_ROOT +
            encodeURIComponent(normalized) +
            ".json",
            {
                method: "GET",
                cache: "no-cache"
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(
                "Failed to load crawl data for " +
                normalized +
                ": HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        return data;
    }


    /*
     * Load all crawl files belonging to approved sites.
     *
     * Domains without a crawl file are returned with
     * crawl: null rather than causing the entire request
     * to fail.
     */
    async function getAllCrawls() {
        const domains =
            await getDomains();

        const results =
            await Promise.all(
                domains.map(
                    async function (domain) {
                        try {
                            return {
                                domain: domain,
                                crawl:
                                    await getCrawl(domain)
                            };
                        } catch (error) {
                            console.error(
                                "Failed to load crawl:",
                                domain,
                                error
                            );

                            return {
                                domain: domain,
                                crawl: null,
                                error: error.message
                            };
                        }
                    }
                )
            );

        return results;
    }


    /*
     * Check whether a domain is approved.
     */
    async function isApproved(domain) {
        const normalized =
            normalizeDomain(domain);

        if (!normalized) {
            return false;
        }

        const domains =
            await getDomains();

        return domains.includes(
            normalized
        );
    }


    /*
     * Check whether a specific URL belongs to an
     * approved domain.
     */
    async function isURLApproved(url) {
        let hostname;

        try {
            hostname =
                new URL(url).hostname.toLowerCase();
        } catch {
            return false;
        }

        const domains =
            await getDomains();

        return domains.some(
            function (domain) {
                return (
                    hostname === domain ||
                    hostname.endsWith(
                        "." + domain
                    )
                );
            }
        );
    }


    /*
     * Expose public API.
     */
    window.NetiteraIndex = {
        getDomains,
        getSites,
        getCrawl,
        getAllCrawls,
        isApproved,
        isURLApproved
    };
})();
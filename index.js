(function () {
    "use strict";

    const INDEX_ROOT =
        "https://netitera.github.io/Index/";

    const APPROVED_URL =
        INDEX_ROOT +
        "indexes/approved.txt";

    const CRAWLED_ROOT =
        INDEX_ROOT +
        "crawled/";

    const SEARCH_ROOT =
        INDEX_ROOT +
        "search/";


    /*
     * ============================================================
     * Domain helpers
     * ============================================================
     */

    function normalizeDomain(value) {
        if (typeof value !== "string") {
            return null;
        }

        let domain = value.trim();

        if (!domain) {
            return null;
        }

        if (domain.startsWith("#")) {
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
            .trim()
            .toLowerCase();

        if (!domain) {
            return null;
        }

        return domain;
    }


    /*
     * ============================================================
     * Approved-site API
     * ============================================================
     */

    async function getDomains() {
        const response = await fetch(
            APPROVED_URL,
            {
                method: "GET",
                cache: "no-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to load approved sites: HTTP " +
                response.status
            );
        }

        const text =
            await response.text();

        const domains = [];
        const seen = new Set();

        for (
            const line of text.split(/\r?\n/)
        ) {
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


    async function getSites() {
        const domains =
            await getDomains();

        return domains.map(
            function (domain) {
                return {
                    domain: domain,
                    url:
                        "https://" +
                        domain
                };
            }
        );
    }


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


    async function isURLApproved(url) {
        let hostname;

        try {
            hostname =
                new URL(url)
                    .hostname
                    .toLowerCase();
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
     * ============================================================
     * Crawl-data API
     *
     * These are still available for the Index page and
     * other consumers. Search does NOT use them.
     * ============================================================
     */

    async function getCrawl(domain) {
        const normalized =
            normalizeDomain(domain);

        if (!normalized) {
            throw new Error(
                "Invalid domain: " +
                domain
            );
        }

        const response =
            await fetch(
                CRAWLED_ROOT +
                encodeURIComponent(
                    normalized
                ) +
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
                "Failed to load crawl for " +
                normalized +
                ": HTTP " +
                response.status
            );
        }

        return await response.json();
    }


    async function getAllCrawls() {
        const domains =
            await getDomains();

        const results = [];

        for (const domain of domains) {
            try {
                const crawl =
                    await getCrawl(domain);

                results.push({
                    domain: domain,
                    crawl: crawl
                });
            } catch (error) {
                results.push({
                    domain: domain,
                    crawl: null,
                    error: error.message
                });
            }
        }

        return results;
    }


    /*
     * ============================================================
     * Static search-index API
     * ============================================================
     */

    let manifestPromise = null;

    const termShardCache =
        new Map();

    const documentShardCache =
        new Map();


    async function getSearchManifest() {
        if (manifestPromise) {
            return manifestPromise;
        }

        manifestPromise =
            fetch(
                SEARCH_ROOT +
                "manifest.json",
                {
                    method: "GET",
                    cache: "no-cache"
                }
            )
            .then(
                async function (response) {
                    if (!response.ok) {
                        throw new Error(
                            "Failed to load search manifest: HTTP " +
                            response.status
                        );
                    }

                    const manifest =
                        await response.json();

                    if (
                        !manifest ||
                        typeof manifest !==
                            "object"
                    ) {
                        throw new Error(
                            "Search manifest is invalid."
                        );
                    }

                    return manifest;
                }
            );

        try {
            return await manifestPromise;
        } catch (error) {
            manifestPromise = null;
            throw error;
        }
    }


    async function getSearchTermShard(
        shard,
        version
    ) {
        const cacheKey =
            String(shard) +
            "|" +
            String(version || "");

        if (
            termShardCache.has(
                cacheKey
            )
        ) {
            return termShardCache.get(
                cacheKey
            );
        }

        const url =
            SEARCH_ROOT +
            "terms/" +
            encodeURIComponent(
                shard
            ) +
            "?v=" +
            encodeURIComponent(
                version || ""
            );

        const promise =
            fetch(
                url,
                {
                    method: "GET",
                    cache: "force-cache"
                }
            )
            .then(
                async function (response) {
                    if (!response.ok) {
                        throw new Error(
                            "Failed to load term shard " +
                            shard +
                            ": HTTP " +
                            response.status
                        );
                    }

                    return await response.json();
                }
            );

        termShardCache.set(
            cacheKey,
            promise
        );

        try {
            return await promise;
        } catch (error) {
            termShardCache.delete(
                cacheKey
            );
            throw error;
        }
    }


    async function getSearchDocumentShard(
        shard,
        version
    ) {
        const cacheKey =
            String(shard) +
            "|" +
            String(version || "");

        if (
            documentShardCache.has(
                cacheKey
            )
        ) {
            return documentShardCache.get(
                cacheKey
            );
        }

        const url =
            SEARCH_ROOT +
            "docs/" +
            encodeURIComponent(
                shard
            ) +
            "?v=" +
            encodeURIComponent(
                version || ""
            );

        const promise =
            fetch(
                url,
                {
                    method: "GET",
                    cache: "force-cache"
                }
            )
            .then(
                async function (response) {
                    if (!response.ok) {
                        throw new Error(
                            "Failed to load document shard " +
                            shard +
                            ": HTTP " +
                            response.status
                        );
                    }

                    return await response.json();
                }
            );

        documentShardCache.set(
            cacheKey,
            promise
        );

        try {
            return await promise;
        } catch (error) {
            documentShardCache.delete(
                cacheKey
            );
            throw error;
        }
    }


    /*
     * ============================================================
     * Public API
     * ============================================================
     */

    window.NetiteraIndex = {
        getDomains,
        getSites,

        getCrawl,
        getAllCrawls,

        isApproved,
        isURLApproved,

        getSearchManifest,
        getSearchTermShard,
        getSearchDocumentShard
    };
})();

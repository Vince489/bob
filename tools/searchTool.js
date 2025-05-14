// searchTool.js

import { searchEngines, maxSearchRetries, excludedDomains, cacheExpiration } from './search_tool/config.js';
import { fetchContent } from './search_tool/fetcher.js';
import { extractSearchResults, extractMainContent } from './search_tool/parser.js';
import { retry, createCache, cleanWhitespace, isValidUrl } from './search_tool/utils.js';

class SearchTool {
    constructor() {
        this.name = "search";
        this.description = "A tool to search the internet for up-to-date information.";
        this.usage = "[TOOL: search(query)] where 'query' is a search term."; // Minor correction to description
        this.inputSchema = { // Renamed from parameters
            type: "object",
            properties: {
                query: { type: "string", description: "The search query." }
            },
            required: ["query"]
        };
        this.searchResultsCache = createCache(cacheExpiration);
        this.contentCache = createCache(cacheExpiration);
    }

    async performSearch(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid search query.');
        }

        console.log(`🔎 [SEARCH ENGINE] Performing search for: "${query}"`);

        const cachedResults = this.searchResultsCache.get(query);
        if (cachedResults) {
            console.log(`🔎 [SEARCH ENGINE] Using cached results for: "${query}"`);
            return cachedResults;
        }

        const allResults = [];
        for (const engine of searchEngines) {
            try {
                const searchUrl = engine.url + encodeURIComponent(query);
                console.log(`🔎 [SEARCH ENGINE] Querying ${engine.name} at: ${searchUrl}`);

                const response = await retry(() => fetchContent(searchUrl), maxSearchRetries, 500);
                if (!response) {
                    console.log(`🔎 [SEARCH ENGINE] No response from ${engine.name}`);
                    continue;
                }

                let results = [];
                if (engine.isHtml) {
                    results = extractSearchResults(response.text, engine.name);
                    console.log(`🔎 [SEARCH ENGINE] Extracted ${results.length} results from ${engine.name} HTML`);
                } else if (response.json?.results) {
                    results = response.json.results.map(r => ({
                        url: r.url,
                        title: cleanWhitespace(r.title),
                        snippet: cleanWhitespace(r.snippet),
                        source: engine.name,
                    })).filter(r => isValidUrl(r.url));
                    console.log(`🔎 [SEARCH ENGINE] Extracted ${results.length} results from ${engine.name} JSON`);
                }

                const filteredResults = results.filter(res => !excludedDomains.some(d => res.url.includes(d)));
                console.log(`🔎 [SEARCH ENGINE] Added ${filteredResults.length} results from ${engine.name} after filtering`);
                allResults.push(...filteredResults);

            } catch (error) {
                console.error(`🔎 [SEARCH ENGINE] Search with ${engine.name} failed:`, error);
            }
        }

        const uniqueResults = Array.from(new Map(allResults.map(r => [r.url, r])).values()).slice(0, 5); //  Unique, top 5

        console.log(`🔎 [SEARCH ENGINE] Returning ${uniqueResults.length} unique results for: "${query}"`);
        if (uniqueResults.length > 0) {
            console.log(`🔎 [SEARCH ENGINE] First result: "${uniqueResults[0].title}"`);
        } else {
            console.log(`🔎 [SEARCH ENGINE] No results found for: "${query}"`);
        }

        this.searchResultsCache.set(query, uniqueResults);
        return uniqueResults;
    }

    async fetchAndProcessContent(results) {
        console.log(`🔎 [SEARCH ENGINE] Fetching and processing content for ${results.length} results`);

        const enrichedResults = [];
        for (const result of results) {
            console.log(`🔎 [SEARCH ENGINE] Processing result: "${result.title}" (${result.url})`);

            let content = this.contentCache.get(result.url);
            if (content) {
                console.log(`🔎 [SEARCH ENGINE] Using cached content for: ${result.url}`);
            } else {
                console.log(`🔎 [SEARCH ENGINE] Fetching content from: ${result.url}`);
                const fetched = await fetchContent(result.url);

                if (fetched?.isHtml) {
                    content = extractMainContent(fetched.text);
                    console.log(`🔎 [SEARCH ENGINE] Extracted ${content.length} characters of content from HTML`);
                    this.contentCache.set(result.url, content);
                } else if (fetched?.json) {
                    content = JSON.stringify(fetched.json);
                    console.log(`🔎 [SEARCH ENGINE] Extracted JSON content`);
                } else {
                    content = 'Non-HTML content or failed to fetch';
                    console.log(`🔎 [SEARCH ENGINE] Failed to extract content or non-HTML content`);
                }
            }

            enrichedResults.push({ ...result, content });
        }

        console.log(`🔎 [SEARCH ENGINE] Returning ${enrichedResults.length} enriched results`);
        return enrichedResults;
    }

    // Expects an object like { query: "search term" } as arguments
    async execute(args) {
        const query = args.query; // Extract the query string from the arguments object
        console.log(`🔎 [SEARCH ENGINE] Starting search process for: "${query}"`);

        try {
            const results = await this.performSearch(query);
            const enrichedResults = await this.fetchAndProcessContent(results);

            console.log(`🔎 [SEARCH ENGINE] Search completed successfully for: "${query}"`);
            return enrichedResults;
        } catch (error) {
            console.error(`🔎 [SEARCH ENGINE] Search failed for: "${query}"`, error);
            return [{
                title: 'Search Error',
                snippet: `Failed to perform search: ${error.message}`,
                url: '#',
                content: 'Search engine error'
            }];
        }
    }
}

// Export an instance of the SearchTool as a named export
export const searchTool = new SearchTool();

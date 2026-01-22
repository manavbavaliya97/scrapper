import * as cheerio from "cheerio";
import mongoose, { Schema, Document, Model } from "mongoose";

/* ===============================
   TYPES
================================ */
interface DownloadButton {
    text: string;
    link: string;
}

interface MovieDocument extends Document {
    title: string;
    slug: string;
    posterUrl: string;
    imdbRating: number;
    description: string;
    screenshots: string[];
    downloadButtons: DownloadButton[];
    genres: string[];
    releaseYear?: number;
    quality?: string;
    cast: string[];
    languages: string[];
    size?: string;
    resolution?: string;
    audio?: string;
    series?: string;
}

/* ===============================
   MONGOOSE MODEL
================================ */
const MovieSchema = new Schema<MovieDocument>(
    {
        title: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        posterUrl: { type: String, required: true },
        imdbRating: { type: Number, required: true },
        description: { type: String, required: true },
        screenshots: [{ type: String }],
        downloadButtons: [{ text: String, link: String }],
        genres: [{ type: String }],
        releaseYear: { type: Number },
        quality: { type: String },
        cast: [{ type: String }],
        languages: [{ type: String }],
        size: { type: String },
        resolution: { type: String },
        audio: { type: String },
        series: { type: String },
    },
    { timestamps: true }
);

const Movie: Model<MovieDocument> =
    mongoose.models.Movie ||
    mongoose.model<MovieDocument>("Movie", MovieSchema);

/* ===============================
   CONFIG
================================ */
const MONGO_URI: string =
    "mongodb+srv://manav:manav@manavdb.uvl1qs4.mongodb.net/test";

const BASE_URL: string = "https://vegavinc.com";

const HEADERS: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
};

const TOTAL_PAGES: number = 538;
const DELAY: number = 1500;

/* ===============================
   UTILS
================================ */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const slugify = (t: string): string =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function fetchHTML(url: string): Promise<string> {
    const res = await fetch(url, { headers: HEADERS });
    return res.text();
}

/* ===============================
   MONGO CONNECT
================================ */
async function connectMongo(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected\n");
}

/* ===============================
   MOVIE DETAIL SCRAPER
================================ */
async function scrapeMovieDetail(
    url: string
): Promise<Partial<MovieDocument>> {

    const html: string = await fetchHTML(url);
    if (!html || html.length < 1000) {
        throw new Error("Blocked HTML");
    }

    const $ = cheerio.load(html);

    const title: string = $("h1.entry-title").text().trim();
    const slug: string = slugify(title);

    const posterUrl: string =
        $('meta[property="og:image"]').attr("content") ||
        "https://via.placeholder.com/300x450";

    const description: string =
        $('meta[name="description"]').attr("content") || title;

    let imdbRating: number = 0;
    let genres: string[] = [];
    let cast: string[] = [];
    let languages: string[] = [];
    let size: string = "";
    let quality: string = "";
    let resolution: string | undefined = "";

    /* ===== INFO BLOCK ===== */
    $("p").each((_, p) => {
        const text: string = $(p).text();

        if (text.includes("IMDb Rating")) {
            imdbRating =
                parseFloat(text.match(/([\d.]+)/)?.[1] ?? "0") || 0;
        }

        $(p).find("strong").each((_, s) => {
            const label: string = $(s)
                .text()
                .replace(":", "")
                .trim()
                .toLowerCase();

            const value: string | undefined =
                (s as unknown as { nextSibling?: { nodeValue?: string } })
                    .nextSibling?.nodeValue?.trim();

            if (!value) return;

            if (label === "genres")
                genres = value.split(",").map(v => v.trim());

            if (label === "cast")
                cast = value.split(",").map(v => v.trim());

            if (label === "original language") {
                if (value.toLowerCase().includes("hi")) languages.push("Hindi");
                if (value.toLowerCase().includes("en")) languages.push("English");
            }

            if (label === "size") size = value;

            if (label === "quality") {
                quality = value;
                resolution =
                    value.match(/(480p|720p|1080p|2160p)/gi)?.join(", ");
            }
        });
    });

    /* ===== DOWNLOAD LINKS ===== */
    const downloadButtons: DownloadButton[] = [];

    $(".download-links-div h3").each((i, h3) => {
        const q: string = $(h3).text().trim();

        if (/(480p|720p|1080p|2160p)/i.test(q)) {
            const link: string | undefined =
                $(".download-links-div h3")
                    .eq(i + 1)
                    .find("a")
                    .attr("href");

            if (link) downloadButtons.push({ text: q, link });
        }
    });

    if (!downloadButtons.length) {
        downloadButtons.push({ text: "Download", link: url });
    }

    /* ===== SCREENSHOTS ===== */
    const screenshots = new Set<string>();

    $("h3").each((_, h3) => {
        if ($(h3).text().toLowerCase().includes("screenshot")) {
            $(h3)
                .nextAll("img")
                .each((_, img) => {
                    let src: string | undefined = $(img).attr("src");
                    if (src) {
                        if (src.startsWith("/")) src = BASE_URL + src;
                        screenshots.add(src);
                    }
                });
        }
    });

    $("img").each((_, img) => {
        let src: string | undefined = $(img).attr("src");
        if (src && /vlcsnap|screenshot|screen|snap/i.test(src)) {
            if (src.startsWith("/")) src = BASE_URL + src;
            screenshots.add(src);
        }
    });

    return {
        title,
        slug,
        posterUrl,
        imdbRating,
        description,
        screenshots: [...screenshots],
        downloadButtons,
        genres,
        cast,
        languages,
        size,
        quality,
        resolution,
    };
}

/* ===============================
   LISTING SCRAPER
================================ */
async function scrapeListingPage(page: number): Promise<string[]> {
    const url: string =
        page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;

    const $ = cheerio.load(await fetchHTML(url));

    return $(".movie-grid h3.entry-title a")
        .map((_, a) => $(a).attr("href")!)
        .get();
}

/* ===============================
   RUNNER
================================ */
async function run(): Promise<void> {
    await connectMongo();

    console.log("🚀 Reverse scraping started");
    console.log(`📚 Total pages: ${TOTAL_PAGES}\n`);

    let totalSaved: number = 0;

    for (let page = TOTAL_PAGES; page >= 1; page--) {
        console.log(`📄 Page ${page}/${TOTAL_PAGES}`);

        const links: string[] = await scrapeListingPage(page);
        console.log(`🎬 Movies found: ${links.length}`);

        for (let i = 0; i < links.length; i++) {
            console.log(`🎥 Page ${page} → ${i + 1}/${links.length}`);

            try {
                const data = await scrapeMovieDetail(links[i]!);

                if (!data.slug) continue;

                if (!(await Movie.findOne({ slug: data.slug }))) {
                    await Movie.create(data);
                    totalSaved++;
                    console.log("✅ Saved:", data.title);
                }
            } catch (e: unknown) {
                if (e instanceof Error) {
                    console.error("❌ Failed:", e.message);
                } else {
                    console.error("❌ Unknown error");
                }
            }

            await sleep(DELAY);
        }

        console.log(`✅ Page ${page} completed\n`);
        await sleep(DELAY * 2);
    }

    console.log(`🏁 Finished | Total saved: ${totalSaved}`);
    await mongoose.disconnect();
}

run();

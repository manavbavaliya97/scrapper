import * as cheerio from "cheerio";
import mongoose, { Schema, Document, Model } from "mongoose";
import fetch from "node-fetch";
import type { AnyNode } from "domhandler";

process.loadEnvFile();

if(process.env.MONGO_URI){
  console.log("found url")
}

interface MovieDocument extends Document {
    title: string;
    slug: string;
    posterUrl: string;
    imdbRating: number;
    description: string;
    screenshots: string[];
    downloadButtons: { text: string; link: string }[];
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
        screenshots: [String],
        downloadButtons: [{ text: String, link: String }],
        genres: [String],
        releaseYear: Number,
        quality: String,
        cast: [String],
        languages: [String],
        size: String,
        resolution: String,
        audio: String,
        series: String,
    },
    { timestamps: true }
);

const Movie: Model<MovieDocument> =
    mongoose.models.Movie || mongoose.model<MovieDocument>("Movie", MovieSchema);

/* ===============================
   CONFIG
================================ */
const MONGO_URI = process.env.MONGO_URI ??
    "mongodb+srv://manav:manav@manavdb.uvl1qs4.mongodb.net/test";

const BASE_URL = "https://vegavinc.com";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
};
const TOTAL_PAGES = 5;
const DELAY = 1500;

/* ===============================
   UTILS
================================ */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const slugify = (t: string): string =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function fetchHTML(url: string): Promise<string> {
    const res = await fetch(url, { headers: HEADERS });
    return await res.text();
}

/* ===============================
   MONGO CONNECT
================================ */
async function connectMongo(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");
}

/* ===============================
   MOVIE DETAIL SCRAPER
================================ */
async function scrapeMovieDetail(url: string): Promise<Partial<MovieDocument>> {
    const html = await fetchHTML(url);
    if (!html || html.length < 1000) throw new Error("Blocked HTML");

    const $ = cheerio.load(html);

    const title = $("h1.entry-title").text().trim();
    const slug = slugify(title);

    const posterUrl =
        $('meta[property="og:image"]').attr("content") ??
        "https://via.placeholder.com/300x450";

    const description =
        $('meta[name="description"]').attr("content") ?? title;

    let imdbRating = 0;
    let genres: string[] = [];
    let cast: string[] = [];
    let languages: string[] = [];
    let size = "";
    let quality = "";
    let resolution = "";

    $("p").each((_: number, p: AnyNode) => {
        const text = $(p).text();

        if (text.includes("IMDb Rating")) {
            imdbRating = parseFloat(text.match(/([\d.]+)/)?.[1] ?? "0");
        }

        $(p).find("strong").each((_: number, s: AnyNode) => {
            const label = $(s).text().replace(":", "").trim().toLowerCase();
            const value = (s as any).nextSibling?.nodeValue?.trim();

            if (!value) return;

            if (label === "genres")
                genres = value.split(",").map((v: string) => v.trim());

            if (label === "cast")
                cast = value.split(",").map((v: string) => v.trim());

            if (label === "original language") {
                if (value.toLowerCase().includes("hi")) languages.push("Hindi");
                if (value.toLowerCase().includes("en")) languages.push("English");
            }

            if (label === "size") size = value;

            if (label === "quality") {
                quality = value;
                resolution =
                    value.match(/(480p|720p|1080p|2160p)/gi)?.join(", ") ?? "";
            }
        });
    });

    /* ===== DOWNLOAD LINKS ===== */
    const downloadButtons: { text: string; link: string }[] = [];

    $(".download-links-div h3").each((i: number, h3: AnyNode) => {
        const q = $(h3).text().trim();
        if (/(480p|720p|1080p|2160p)/i.test(q)) {
            const link = $(".download-links-div h3")
                .eq(i + 1)
                .find("a")
                .attr("href");
            if (link) downloadButtons.push({ text: q, link });
        }
    });

    if (!downloadButtons.length) {
        downloadButtons.push({ text: "Download", link: url });
    }



     const screenshots : string[] = [];
    $("img").each((_, img) => {
        let src = $(img).attr("src");
        if (src && src.includes("vlcsnap")) {
            if (src.startsWith("/")) src = BASE_URL + src;
            screenshots.push(src);
        }
    });

 

    return {
        title,
        slug,
        posterUrl,
        imdbRating,
        description,
        screenshots,
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
    const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const $ = cheerio.load(await fetchHTML(url));

    return $(".movie-grid h3.entry-title a")
        .map((_: number, a: AnyNode) => $(a).attr("href")!)
        .get();
}

/* ===============================
   RUNNER
================================ */
async function run(): Promise<void> {
    await connectMongo();

    let links: string[] = [];

    for (let p = 1; p <= TOTAL_PAGES; p++) {
        links.push(...await scrapeListingPage(p));
        await sleep(DELAY);
    }

    links = [...new Set(links)];
    console.log("🎬 Movies:", links.length);

    for (const link of links) {
        try {
            const data = await scrapeMovieDetail(link);
            if (!data.slug) continue;

            if (!(await Movie.findOne({ slug: data.slug }))) {
                await Movie.create(data);
                console.log("✅ Saved:", data.title);
            }
        } catch (e: any) {
            console.error("❌ Error:", link, e.message);
        }
        await sleep(DELAY);
    }

    await mongoose.disconnect();
    console.log("🏁 Done");
}

run();

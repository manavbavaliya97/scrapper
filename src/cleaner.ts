import * as cheerio from "cheerio";
import mongoose, { Schema, Document, Model } from "mongoose";

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

const MONGO_URI: string =
    "mongodb+srv://manav:manav@manavdb.uvl1qs4.mongodb.net/test";

const BASE_URL: string = "https://vegavinc.com";

const HEADERS: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
};

const DELAY: number = 1500;

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const slugify = (t: string): string =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function fetchHTML(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            ...HEADERS,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://google.com/"
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return res.text();
}


async function connectMongo(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected\n");
}


async function scrapeMovieDetail(
    url: string
): Promise<Partial<MovieDocument>> {

    const html: string = await fetchHTML(url);
    if (!html || html.length < 1000) {
        throw new Error("Blocked HTML");
    }

    const $ = cheerio.load(html);

    const downloadButtons: DownloadButton[] = [];

     $(".download-links-div a.btn").each((_, el) => {
    const link = $(el).attr("href");

    const text = $(el)
      .find("button")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (link) {
      downloadButtons.push({
        text: text || "Download",
        link
      });
    }
  });

    return {
        downloadButtons,
    };
}

async function run() {
    await connectMongo();

    const movies = await Movie.find({
        "downloadButtons.link": {
            $regex: "^https://vegavinc\\.com/"
        }
    });

    console.log(`Found ${movies.length} movies to process\n`);

    for (const movie of movies) {
        const link = movie.downloadButtons[0]?.link;
        if (!link) continue;

        try {
            const newData = await scrapeMovieDetail(link);

            if (!newData.downloadButtons || !newData.downloadButtons.length) {
                console.log("🗑 Deleting movie (no buttons):", movie.slug);
                await Movie.deleteOne({ _id: movie._id });
            } else {
                movie.downloadButtons = newData.downloadButtons;
                await movie.save();

                console.log("✅ Updated:", movie.slug);
            }
        } catch (err) {
            console.error("❌ Failed:", movie.slug, link);
        }

        await sleep(DELAY);
    }

    console.log("\n🎉 Done");
}

run();

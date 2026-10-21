import type { Model } from "mongoose";
import type { z } from "zod";
import { FaqModel, faqInputSchema } from "../modules/content/faq.js";
import { PageModel, pageInputSchema } from "../modules/content/page.js";
import { PlanModel, planInputSchema } from "../modules/content/plan.js";
import { PostModel, postInputSchema } from "../modules/content/post.js";
import { ServiceModel, serviceInputSchema } from "../modules/content/service.js";
import {
  SettingModel,
  getSiteSettings,
  saveSiteSettings,
  settingsSchema,
} from "../modules/content/setting.js";
import { TestimonialModel, testimonialInputSchema } from "../modules/content/testimonial.js";
import content from "./content.json" with { type: "json" };

type Collection = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  schema: z.ZodObject;
  items: unknown[];
  /** Fields that identify an existing document, so re-running the seed updates instead of duplicating. */
  key: string[];
};

const collections: Collection[] = [
  { name: "posts", model: PostModel, schema: postInputSchema, items: content.posts, key: ["slug"] },
  {
    name: "plans",
    model: PlanModel,
    schema: planInputSchema,
    items: content.plans,
    key: ["kind", "name"],
  },
  {
    name: "services",
    model: ServiceModel,
    schema: serviceInputSchema,
    items: content.services,
    key: ["title"],
  },
  {
    name: "faqs",
    model: FaqModel,
    schema: faqInputSchema,
    items: content.faqs,
    key: ["page", "question"],
  },
  {
    name: "testimonials",
    model: TestimonialModel,
    schema: testimonialInputSchema,
    items: content.testimonials,
    key: ["name"],
  },
  { name: "pages", model: PageModel, schema: pageInputSchema, items: content.pages, key: ["slug"] },
];

/**
 * Loads the website's starter content (src/seed/content.json).
 * Only adds what is missing (matched by natural key), so edits made in the admin
 * panel are kept. With `reset`, content is replaced by the defaults.
 */
export async function seedContent({ reset = false } = {}) {
  const summary: Record<string, number> = {};

  for (const { name, model, schema, items, key } of collections) {
    if (reset) await model.deleteMany({});

    const operations = items.map((raw) => {
      const doc = schema.parse(raw) as Record<string, unknown>;
      const filter = Object.fromEntries(key.map((k) => [k, doc[k]]));
      const update = reset ? { $set: doc } : { $setOnInsert: doc };
      return { updateOne: { filter, update, upsert: true } };
    });
    await model.bulkWrite(operations);
    summary[name] = operations.length;
  }

  if (reset) await SettingModel.deleteMany({});
  if (!(await getSiteSettings())) await saveSiteSettings(settingsSchema.parse(content.settings));
  summary.settings = 1;

  return summary;
}

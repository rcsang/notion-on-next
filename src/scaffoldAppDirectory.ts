import {
  DatabaseObjectResponse,
  GetDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import fs from "fs";
import { getDatabase } from "./getFromNotion";
import { checkNextVersionNumber, pascalCase, spinalCase } from "./utils";

export const scaffoldApp = async (
  database: DatabaseObjectResponse | string,
  language = "typescript"
) => {
  if (typeof database === "string") {
    const res = await getDatabase(database);
    if (res) {
      database = res;
    }
  }
  database = database as DatabaseObjectResponse;
  // Check if package.json contains next 13 or greater
  const nextVersionCompatible = checkNextVersionNumber(13);
  if (!nextVersionCompatible) {
    console.log("Please update your next version to 13 or greater");
    return;
  }
  const databaseName = database?.title[0]?.plain_text;
  const databaseId = database.id;
  const databaseNameSpinalCase = spinalCase(databaseName);
  const databaseNamePascalCase = pascalCase(databaseName);

  const databasePath = `./app/${databaseNameSpinalCase}`;
  if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath);
  }

  const fileExtension = language === "typescript" ? "ts" : "js";

  const pagePath = `${databasePath}/page.tsx`;
  const cardPath = `${databasePath}/${databaseNamePascalCase}Card.tsx`;
  const slugPath = `${databasePath}/[slug]`;
  const slugPagePath = `${databasePath}/[slug]/page.tsx`;
  const getPath = `./app/get.ts`;

  const replaceInPageTemplate = (pageTemplate: string) => {
    return pageTemplate
      .replace(/DATABASENAMEPASCAL/g, databaseNamePascalCase)
      .replace(/DATABASENAMESPINAL/g, databaseNameSpinalCase)
      .replace(/DATABASEID/g, databaseId)
      .replace(/@ts-nocheck/g, "");
  };

  fs.copyFileSync(
    `./node_modules/notion-on-next/templates/${language}/get.${fileExtension}`,
    getPath
  );

  const pageTemplate = fs.readFileSync(
    `./node_modules/notion-on-next/templates/${language}/page.${fileExtension}x`,
    "utf8"
  );
  const pageTemplateReplaced = replaceInPageTemplate(pageTemplate);
  fs.writeFileSync(pagePath, pageTemplateReplaced);

  const cardTemplate = fs.readFileSync(
    `./node_modules/notion-on-next/templates/${language}/Card.${fileExtension}x`,
    "utf8"
  );
  const cardTemplateReplaced = replaceInPageTemplate(cardTemplate);

  fs.writeFileSync(cardPath, cardTemplateReplaced);

  if (!fs.existsSync(slugPagePath)) {
    fs.mkdirSync(slugPath);
  }
  const slugPageTemplate = fs.readFileSync(
    `./node_modules/notion-on-next/templates/${language}/[slug]/page.${fileExtension}x`,
    "utf8"
  );
  const slugPageTemplateReplaced = replaceInPageTemplate(slugPageTemplate);
  fs.writeFileSync(slugPagePath, slugPageTemplateReplaced);

  console.log(
    "🎉  Scaffolded database: " + databaseName + "in " + databasePath + "\n"
  );
};

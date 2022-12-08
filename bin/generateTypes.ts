#! /usr/bin/env node
import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import fs from "fs";
import { getDatabase } from "../src/getFromNotion";
import { configInterface } from "../types/types";
import { createFolderIfDoesNotExist } from "./utils";

export const generateTypes = async () => {
  // Read users config file
  const configPath = "./notion-on-next.config.json";
  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8")
  ) as configInterface;
  await createFolderIfDoesNotExist(`${config.typesFolderPath}`);
  // Generate types from the user's config file
  await initializeTypes(`${config.typesFolderPath}/notion-on-next.types.ts`);
  for (const databaseId in config.databases) {
    const database = await getDatabase(databaseId);
    if (!database) {
      console.log(
        `Could not find database with id ${databaseId}. Please check your config file.`
      );
      return;
    }
    await generateTypesFromDatabase(
      `${config.typesFolderPath}/notion-on-next.types.ts`,
      database
    );
  }
};

export const initializeTypes = async (path: string) => {
  fs.writeFileSync(
    path,
    `
      import {
        PageObjectResponse,
      } from "@notionhq/client/build/src/api-endpoints";
      
      export interface NotionOnNextPageObjectResponse extends PageObjectResponse {
        slug: string | undefined;
        title: string | undefined;
        coverImage: string | undefined;
      }
      export interface mediaMapInterface {
        [key: string]: {
          [key: string]: {
            [key: string]: string;
          };
        };
      }
      `
  );
  console.log("Created notion-on-next.types.ts");
};

export const generateTypesFromDatabase = async (
  path: string,
  database: GetDatabaseResponse
) => {
  // @ts-ignore -- Notion API types are not consistent with the actual API
  const databaseName = database.title[0].plain_text.replace(/[^a-z0-9]/gi, "");
  const databaseProperties = database.properties;
  const propertyTypeMap = {
    rich_text: "RichTextItemResponse",
    select: "SelectPropertyItemObjectResponse",
    number: "NumberPropertyItemObjectResponse",
    title: "TitlePropertyItemObjectResponse",
    multi_select: "MultiSelectPropertyItemObjectResponse",
    checkbox: "CheckboxPropertyItemObjectResponse",
    url: "UrlPropertyItemObjectResponse",
    email: "EmailPropertyItemObjectResponse",
    date: "DatePropertyItemObjectResponse",
    person: "PersonPropertyItemObjectResponse",
  };
  const allBlockTypesFromResponse = Object.keys(databaseProperties).map(
    (key) => {
      const property = databaseProperties[key];
      return property.type;
    }
  );
  const uniqueBlockTypesFromDatabase = Array.from(
    new Set(allBlockTypesFromResponse)
  );
  console.log("uniqueBlockTypesFromDatabase", uniqueBlockTypesFromDatabase);
  const allBlockTypeImports = uniqueBlockTypesFromDatabase
    .map((type) => propertyTypeMap[type as keyof typeof propertyTypeMap])
    .filter(Boolean); // filter out undefined

  await updateImports(path, allBlockTypeImports);
  const typeDefStart = `\nexport type ${databaseName}PageObjectResponse = NotionOnNextPageObjectResponse & {\n\tproperties: {\n`;
  const typeDefEnd = `\n\t}\n}`;
  const typeDefProperties = Object.keys(databaseProperties).map((key) => {
    const property = databaseProperties[key];
    const propertyType = property.type;
    const propertyTypeMapped =
      propertyTypeMap[propertyType as keyof typeof propertyTypeMap];
    return `\t\t'${key}': ${propertyTypeMapped};`;
  });

  const typeDef = typeDefStart + typeDefProperties.join("\n") + typeDefEnd;
  await appendToFile(path, typeDef, () => {
    console.log("Appended files to" + path);
  });
};

const extractImports = (notionImportString: string) => {
  // Pull out the items from the import statement
  //@ts-ignore
  const items = notionImportString
    .match(/{[^}]*}/g)[0]
    .replace(/[{}]/g, "")
    .replace(/\s/g, "")
    .replace(/,\n/g, "")
    .trim()
    .split(",");
  return items;
};

export const updateImports = (
  filePath: string,
  uniqueBlockTypesFromDatabase: string[]
) => {
  // return a promise
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", function (err, contents) {
      if (err) {
        console.log(err);
        return reject(err);
      }
      const notionImportString = contents.match(
        /import\s*{[^}]*}\s*from\s*["']@notionhq\/client\/build\/src\/api-endpoints["']/g
      )?.[0];
      if (!notionImportString) {
        console.log("Could not find notion import string");
        return;
      }
      const currentImportedNotionTypes = extractImports(notionImportString);
      const combinedTypeImports = Array.from(
        new Set([
          ...currentImportedNotionTypes,
          ...uniqueBlockTypesFromDatabase,
          "PageObjectResponse",
        ])
      );
      // Filter out dupes
      const uniqueCombinedTypeImports = Array.from(
        new Set(combinedTypeImports)
      ).filter(Boolean);

      const updatedNotionImports = `import { ${uniqueCombinedTypeImports.join(
        ", "
      )} } from "@notionhq/client/build/src/api-endpoints";`;

      const updatedContents = contents.replace(
        notionImportString,
        updatedNotionImports
      );
      fs.writeFile(filePath, updatedContents, "utf-8", function (err) {
        if (err) {
          console.log(err);
          return;
        }
        console.log("Updated imports in ", filePath);
        resolve("done");
      });
    });
  });
};

export const replaceImports = (filePath: string, newImports: string) => {
  // return a promise
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", function (err, contents) {
      if (err) {
        console.log(err);
        return reject(err);
      }

      const currentImports = contents
        .match(/import \{(.|\n)*?\} from/g)?.[0]
        .split(",")
        .map((currentImport: string) => currentImport.trim());
      console.log("currentImports", currentImports);
      let updatedImports = "";
      if (currentImports) {
        console.log("inside of current imports");
        // Filter out any newImports that already exist in currentImports
        const newImportsFiltered = newImports
          .split(",")
          .map((newImport: string) => newImport.trim())
          .filter((newImport: string) => {
            return !currentImports.includes(newImport);
          });
        const combinedImports = [...currentImports, newImportsFiltered];
        console.log("combinedImports", combinedImports);
        updatedImports = combinedImports.join(", ");
      } else {
        updatedImports = newImports;
      }

      // const newContents is replacing anything between "import {" and "} from"
      const newContents = contents.replace(
        /import \{(.|\n)*?\} from/g,
        newImports
      );

      fs.writeFile(filePath, newContents, "utf-8", function (err) {
        if (err) {
          console.log(err);
          return;
        }
        console.log("Updated imports in ", filePath);
        resolve("done");
      });
    });
  });
};

export const appendToFile = async (
  filePath: string,
  data: string,
  callback: () => void
) => {
  return new Promise((resolve, reject) => {
    fs.appendFile(filePath, data, (err) => {
      if (err) reject(err);
      callback();
      resolve("done");
    });
  });
};

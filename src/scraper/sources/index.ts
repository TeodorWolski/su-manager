import type { Source } from "../types";
import { evently } from "./evently";
import { kupbilecik } from "./kupbilecik";

export const SOURCES: Source[] = [kupbilecik, evently];

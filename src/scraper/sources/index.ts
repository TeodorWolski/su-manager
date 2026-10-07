import type { Source } from "../types";
import { biletyna } from "./biletyna";
import { evently } from "./evently";
import { kupbilecik } from "./kupbilecik";

export const SOURCES: Source[] = [kupbilecik, evently, biletyna];

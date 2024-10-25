import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const schoolId = "U2Nob29sLTEzODE=";

export interface RMPResponse {
  data: Data;
}

export interface Data {
  search: Search;
}

export interface Search {
  teachers: Teachers;
}

export interface Teachers {
  didFallback: boolean;
  edges: Edge[];
  filters: Filter[];
  pageInfo: PageInfo;
  resultCount: number;
}

export interface Edge {
  cursor: string;
  node: Professor;
}

export interface Professor {
  __typename: string;
  avgDifficulty: number;
  avgRating: number;
  department: string;
  firstName: string;
  id: string;
  isSaved: boolean;
  lastName: string;
  legacyId: number;
  numRatings: number;
  school: School;
  wouldTakeAgainPercent: number;
}

export interface School {
  id: string;
  name: string;
}

export interface Filter {
  field: string;
  options: Option[];
}

export interface Option {
  id: string;
  value: string;
}

export interface PageInfo {
  endCursor: string;
  hasNextPage: boolean;
}

const loadByCursor = async (cursor?: string | null) => {
  const response = await axios.post<RMPResponse>(
    "https://www.ratemyprofessors.com/graphql",
    {
      query: `query TeacherSearchResultsPageQuery(
  $query: TeacherSearchQuery!
  $count: Int!
  ${cursor ? "$cursor: String" : ""}
) {
  search: newSearch {
    ...TeacherSearchPagination_search_1ZLmLD
  }
}

fragment TeacherSearchPagination_search_1ZLmLD on newSearch {
  teachers(query: $query, first: $count, after: ${cursor ? "$cursor" : '""'}) {
    didFallback
    edges {
      node {
        ...TeacherCard_teacher
        id
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    resultCount
  }
}

fragment TeacherCard_teacher on Teacher {
  id
  legacyId
  avgRating
  numRatings
  ...CardFeedback_teacher
  ...CardSchool_teacher
  ...CardName_teacher
  ...TeacherBookmark_teacher
}

fragment CardFeedback_teacher on Teacher {
  wouldTakeAgainPercent
  avgDifficulty
}

fragment CardSchool_teacher on Teacher {
  department
  school {
    name
    id
  }
}

fragment CardName_teacher on Teacher {
  firstName
  lastName
}

fragment TeacherBookmark_teacher on Teacher {
  id
  isSaved
}
`,
      variables: {
        query: {
          schoolID: schoolId,
        },
        ...(cursor ? { cursor } : {}),
        count: 1000,
      },
    },
    {
      headers: {
        Accept: "*/*",
        "Accept-Language": "en",
        Authorization: "Basic dGVzdDp0ZXN0",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        Cookie: "ccpa-notice-viewed-02=true",
        Origin: "https://www.ratemyprofessors.com",
        Referer: "https://www.ratemyprofessors.com/search.jsp",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    }
  );
  return response.data;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const run = async () => {
  let cursor: string | null = null;
  let professors: Professor[] = [];
  while (true) {
    const data = await loadByCursor(cursor);
    const { teachers } = data.data.search;
    professors = professors.concat(teachers.edges.map((l) => l.node));
    if (!teachers.pageInfo.hasNextPage) {
      break;
    }
    cursor = teachers.pageInfo.endCursor;
    console.log(`Fetched ${professors.length} professors`);
  }

  const existing = await fs.readFile(
    path.join(__dirname, "../data/ratings.json"),
    "utf-8"
  );
  const existingProfessors = JSON.parse(existing);
  const newProfessorIds = new Set(professors.map((p: Professor) => p.id));
  const professorsToAdd = existingProfessors.filter(
    (p: Professor) => !newProfessorIds.has(p.id)
  );
  professors = professors.concat(professorsToAdd);
  // sort professors by their id
  professors.sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(
    path.join(__dirname, "../data/ratings.json"),
    JSON.stringify(professors, null, 4)
  );
};
run();

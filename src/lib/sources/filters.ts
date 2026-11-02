// Decides which postings are worth keeping: security roles located in the US
// (or remote within the US).

const SECURITY_TITLE =
  /(secur|cyber|detection|incident response|threat|appsec|\biam\b|identity( and| &)? access|\bgrc\b|vulnerab|penetration|pen ?test|red team|blue team|purple team|devsecops|forensic|malware|\bciso\b|trust (and|&) safety engineer)/i;
// Case-sensitive: "SOC" is a Security Operations Center, "SoC" is a System-on-Chip.
const SOC_TITLE = /\bSOC\b/;

const NOT_ENGINEERING =
  /(sales|account (executive|manager)|business development|\bbdr\b|\bsdr\b|marketing|recruit|counsel|attorney|legal|paralegal|guard|officer\b(?!.*information)|customer success|partner manager|events?\b|communications|product manager|program manager|\bmanager\b|\bauditor\b|\bintern(ship)?\b|special programs|industrial security|physical security|facility security|enablement)/i;

const TOO_SENIOR = /(\bdirector\b|\bvp\b|vice president|head of|\bchief\b|\bciso\b)/i;

// Gig listings that reuse security titles ("Cloud Security Engineer - AI Trainer").
const NOT_A_REAL_ROLE = /(ai trainer|data annotat|annotation|freelance writer|tutor\b)/i;

// "Security" in these phrases says nothing about the role itself.
const INCIDENTAL_SECURITY = /(security clearance|national security|social security|clearance required)/gi;

export function isSecurityRole(title: string): boolean {
  const core = title.replace(INCIDENTAL_SECURITY, " ");
  return (
    (SECURITY_TITLE.test(core) || SOC_TITLE.test(core)) &&
    !NOT_ENGINEERING.test(title) &&
    !TOO_SENIOR.test(title) &&
    !NOT_A_REAL_ROLE.test(title)
  );
}

const STATES =
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(
    " ",
  );

const STATE_NAMES =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

const US_CITIES =
  /\b(san francisco|sf bay|bay area|seattle|austin|boston|chicago|denver|atlanta|los angeles|san jose|palo alto|mountain view|sunnyvale|menlo park|santa clara|redwood city|san diego|portland|phoenix|dallas|houston|miami|nyc|brooklyn|raleigh|reston|arlington|mclean|herndon|pittsburgh|philadelphia|minneapolis|salt lake|nashville|columbus|charlotte|detroit|baltimore|tampa|orlando|boulder|washington,? d\.?c\.?)\b/i;

const US_MARKER = /(united states|\bu\.?s\.?a?\b|\bamericas?\b|north america)/i;

const NON_US =
  /\b(canada|toronto|vancouver|montreal|ontario|mexico|brazil|argentina|colombia|united kingdom|\buk\b|england|london|ireland|dublin|germany|berlin|munich|france|paris|spain|madrid|barcelona|portugal|lisbon|netherlands|amsterdam|poland|warsaw|romania|czech|prague|sweden|stockholm|denmark|norway|finland|switzerland|zurich|austria|italy|israel|tel aviv|india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|delhi|gurgaon|noida|singapore|japan|tokyo|korea|seoul|china|hong kong|taiwan|australia|sydney|melbourne|new zealand|philippines|manila|vietnam|indonesia|malaysia|thailand|uae|dubai|saudi|south africa|nigeria|kenya|egypt|turkey|emea|apac|latam|europe)\b/i;

/** True when a location string points to the US or to unrestricted remote work. */
export function isUsLocation(location: string, country?: string | null): boolean {
  if (country) {
    const c = country.trim().toLowerCase();
    if (["us", "usa", "united states", "united states of america"].includes(c)) return true;
  }
  const loc = location.trim();
  if (!loc) return !country;
  const hasState = STATES.some((s) => new RegExp(`(,|\\b)\\s*${s}\\b(?![a-z])`).test(loc));
  const usHint = US_MARKER.test(loc) || STATE_NAMES.test(loc) || US_CITIES.test(loc) || hasState;
  if (usHint) return true;
  if (NON_US.test(loc)) return false;
  if (country) return false;
  // "Remote" or "Anywhere" with no country: keep it and let the user judge.
  return /(remote|anywhere|distributed)/i.test(loc);
}

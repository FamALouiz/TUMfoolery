// Team logo mapping for Premier League teams

const teamLogoMap: Record<string, string> = {
  // Full team names
  Arsenal: "/Icons/Aresenal.png",
  "Aston Villa": "/Icons/Villa.png",
  Bournemouth: "/Icons/Bournemouth.png",
  Brentford: "/Icons/Brentford.png",
  Brighton: "/Icons/Brighton.png",
  Burnley: "/Icons/Burnley.png",
  Chelsea: "/Icons/Chelsea.png",
  "Manchester City": "/Icons/City.png",
  "Crystal Palace": "/Icons/Palace.png",
  Everton: "/Icons/Everton.png",
  Fulham: "/Icons/Fulham.png",
  Leeds: "/Icons/Leeds.png",
  Leicester: "/Icons/Leicester.png",
  Liverpool: "/Icons/Liverpool.png",
  "Manchester United": "/Icons/United.png",
  Newcastle: "/Icons/Newcastle.png",
  "Nottingham Forest": "/Icons/Forest.png",
  Southampton: "/Icons/Southampton.png",
  Sunderland: "/Icons/Sunderland.png",
  Tottenham: "/Icons/Spurs.png",
  "West Ham": "/Icons/Westham.png",
  Wolves: "/Icons/Wolves.png",

  // Shortened names
  Spurs: "/Icons/Spurs.png",
  "Man City": "/Icons/City.png",
  "Man Utd": "/Icons/United.png",
  "Man United": "/Icons/United.png",
  "Newcastle United": "/Icons/Newcastle.png",
  "West Ham United": "/Icons/Westham.png",
  Wolverhampton: "/Icons/Wolves.png",
  "Brighton & Hove Albion": "/Icons/Brighton.png",

  // Common abbreviations (3-letter codes)
  ARS: "/Icons/Aresenal.png",
  AVL: "/Icons/Villa.png",
  BOU: "/Icons/Bournemouth.png",
  BRE: "/Icons/Brentford.png",
  BHA: "/Icons/Brighton.png",
  BUR: "/Icons/Burnley.png",
  CHE: "/Icons/Chelsea.png",
  MCI: "/Icons/City.png",
  CRY: "/Icons/Palace.png",
  EVE: "/Icons/Everton.png",
  FUL: "/Icons/Fulham.png",
  LEE: "/Icons/Leeds.png",
  LEI: "/Icons/Leicester.png",
  LIV: "/Icons/Liverpool.png",
  MUN: "/Icons/United.png",
  NEW: "/Icons/Newcastle.png",
  NFO: "/Icons/Forest.png",
  SOU: "/Icons/Southampton.png",
  SUN: "/Icons/Sunderland.png",
  TOT: "/Icons/Spurs.png",
  WHU: "/Icons/Westham.png",
  WOL: "/Icons/Wolves.png",
};

/**
 * Get the logo path for a team name
 * @param teamName - The name of the team (full name, shortened name, or abbreviation)
 * @returns The path to the team logo, or the default Premier League logo if not found
 */
export function getTeamLogo(teamName: string): string {
  if (!teamName) {
    return "/Icons/PL.png";
  }

  // Direct match
  if (teamLogoMap[teamName]) {
    return teamLogoMap[teamName];
  }

  // Case-insensitive match
  const normalizedName = teamName.trim();
  const entry = Object.entries(teamLogoMap).find(
    ([key]) => key.toLowerCase() === normalizedName.toLowerCase()
  );

  if (entry) {
    return entry[1];
  }

  // Partial match (for cases where the input contains the team name)
  const partialMatch = Object.entries(teamLogoMap).find(
    ([key]) =>
      normalizedName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(normalizedName.toLowerCase())
  );

  if (partialMatch) {
    return partialMatch[1];
  }

  // Default to Premier League logo
  return "/Icons/PL.png";
}

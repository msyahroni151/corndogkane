const leaderAreaNames = new Map([
  ["EPUL", "AREA 1"],
  ["AZI", "AREA 2"],
  ["ZAEN", "AREA 3"],
  ["DADAN", "AREA 4"],
]);

export function leaderHomeAreaName(employeeCode: string | null) {
  return leaderAreaNames.get(employeeCode?.trim().toUpperCase() ?? "");
}

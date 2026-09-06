// "200, 401" -> [200, 401]
export function parseCodes(codes: string): number[] {
	return codes.split(",").map((code) => Number(code.trim()));
}

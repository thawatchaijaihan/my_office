import { describe, it, expect } from "vitest";
import { personnelKey } from "./personnelDb";

describe("personnelKey", () => {
  it("joins rank first last with single space", () => {
    expect(personnelKey("พ.ท.", "จักรพงษ์", "ไมตรีประศาสน์")).toBe(
      "พ.ท. จักรพงษ์ ไมตรีประศาสน์"
    );
  });

  it("trims and collapses spaces", () => {
    expect(personnelKey("  ร.อ.  ", "  กฤตภาส  ", "  ชัยบัณฑิตย์  ")).toBe(
      "ร.อ. กฤตภาส ชัยบัณฑิตย์"
    );
  });

  it("handles empty parts", () => {
    expect(personnelKey("", "ชื่อ", "สกุล")).toBe("ชื่อ สกุล");
    expect(personnelKey("ยศ", "", "สกุล")).toBe("ยศ สกุล");
  });
});

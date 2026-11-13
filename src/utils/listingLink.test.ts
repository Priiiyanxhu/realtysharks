import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listingHref } from "./listingLink.ts";

const ID = "0b9c6a3e-5f1d-4a7e-9c2b-1d8e4f6a7b90";

describe("listingHref", () => {
  it("links a well-formed listing id to the listing page", () => {
    assert.equal(listingHref(ID), `/listings/${ID}`);
  });

  it("normalises case so the same listing has one URL", () => {
    assert.equal(listingHref(ID.toUpperCase()), `/listings/${ID}`);
  });

  it("refuses anything that could change the destination", () => {
    const hostile = [
      "../profile",
      "..%2Fprofile",
      `${ID}/../../profile`,
      `${ID}?next=/login`,
      `${ID}#x`,
      `${ID} `,
      ` ${ID}`,
      `${ID}\n`,
      "//evil.example",
      "https://evil.example/listings/" + ID,
      "javascript:alert(1)",
    ];
    for (const value of hostile) assert.equal(listingHref(value), null, JSON.stringify(value));
  });

  it("refuses malformed ids and non-strings", () => {
    for (const value of ["", "123", ID.slice(1), ID + "0", ID.replaceAll("-", ""), null, undefined, 42, {}, [ID]]) {
      assert.equal(listingHref(value), null, JSON.stringify(value));
    }
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { brokerProfileHref } from "./brokerLink.ts";

const ID = "0b9c6a3e-5f1d-4a7e-9c2b-1d8e4f6a7b90";

describe("brokerProfileHref", () => {
  it("links to the broker's profile", () => {
    assert.equal(brokerProfileHref(ID), `/network/${ID}`);
  });

  it("can open the Requirements tab", () => {
    assert.equal(brokerProfileHref(ID, "requirements"), `/network/${ID}?tab=requirements`);
  });

  it("normalises case so a broker has one URL", () => {
    assert.equal(brokerProfileHref(ID.toUpperCase(), "requirements"), `/network/${ID}?tab=requirements`);
  });

  it("returns null (no link) when the broker id is missing or not a uuid", () => {
    for (const value of [null, undefined, "", "123", "../profile", `${ID}/../x`, `${ID}?x=1`, `${ID} `, 42, {}, [ID]]) {
      assert.equal(brokerProfileHref(value), null, JSON.stringify(value));
      assert.equal(brokerProfileHref(value, "requirements"), null, JSON.stringify(value));
    }
  });
});

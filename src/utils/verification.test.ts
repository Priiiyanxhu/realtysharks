import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVerifiedBroker } from "./verification.ts";

describe("isVerifiedBroker", () => {
  it("is true only when verified is exactly true", () => {
    assert.equal(isVerifiedBroker({ verified: true }), true);
  });

  it("is false when verified is false, missing or null", () => {
    for (const profile of [{ verified: false }, {}, { verified: null }, { verified: undefined }]) {
      assert.equal(isVerifiedBroker(profile), false, JSON.stringify(profile));
    }
  });

  it("is not fooled by truthy look-alikes", () => {
    for (const verified of ["true", "yes", 1, "verified", {}, [], [true]]) {
      assert.equal(isVerifiedBroker({ verified }), false, JSON.stringify(verified));
    }
  });

  it("does not derive verification from a RERA number or KYC fields a broker can influence", () => {
    assert.equal(isVerifiedBroker({ rera_number: "PRM12345678" }), false);
    assert.equal(isVerifiedBroker({ rera_number: "PRM12345678", verified: false, kyc_status: "pending" }), false);
    assert.equal(isVerifiedBroker({ kyc_status: "verified" }), false, "kyc_status alone is not the badge flag");
    assert.equal(isVerifiedBroker({ is_verified: true }), false, "the legacy column is not read by the app");
  });

  it("reads the first element of an embedded-relation array", () => {
    assert.equal(isVerifiedBroker([{ verified: true }]), true);
    assert.equal(isVerifiedBroker([{ verified: false }, { verified: true }]), false);
    assert.equal(isVerifiedBroker([]), false);
  });

  it("is false for a missing profile", () => {
    for (const profile of [null, undefined, "", 0, "profile", true]) {
      assert.equal(isVerifiedBroker(profile), false, String(profile));
    }
  });
});

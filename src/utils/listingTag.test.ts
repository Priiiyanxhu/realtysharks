import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseListingTag } from "./listingTag.ts";

const ID = "0b9c6a3e-5f1d-4a7e-9c2b-1d8e4f6a7b90";
// Same shape the Messages page writes when sending.
const tagged = (id: string, title = "Premium Villa #4", price = "3.25 Cr", location = "Pune", text = "Is this available?") =>
  `__TAG_LISTING:${id}|${title}|${price}|${location}__\n${text}`;

describe("parseListingTag", () => {
  it("returns the message untouched when there is no tag", () => {
    const parsed = parseListingTag("just a message");
    assert.deepEqual(parsed, { listing: null, href: null, text: "just a message" });
  });

  it("extracts the listing, strips the tag, and links to the listing page", () => {
    const parsed = parseListingTag(tagged(ID));
    assert.deepEqual(parsed.listing, { id: ID, title: "Premium Villa #4", price: "3.25 Cr", location: "Pune" });
    assert.equal(parsed.text, "Is this available?");
    assert.equal(parsed.href, `/listings/${ID}`);
  });

  it("a tag with no accompanying text leaves an empty message body", () => {
    assert.equal(parseListingTag(tagged(ID, undefined, undefined, undefined, "")).text, "");
  });

  it("keeps the card but offers NO link when the id is not a listing id", () => {
    // The id is whatever the sender typed into the message; it must never reach a URL unchecked.
    for (const id of ["../profile", "..%2Fprofile", "123", "javascript:alert(1)", `${ID}/../../x`, "//evil.example", `${ID}?x=1`]) {
      const parsed = parseListingTag(tagged(id));
      assert.ok(parsed.listing, `card still parsed for ${id}`);
      assert.equal(parsed.listing?.id, id);
      assert.equal(parsed.href, null, id);
    }
  });

  it("title and location are carried through as plain text, never interpreted", () => {
    const parsed = parseListingTag(tagged(ID, "<img src=x onerror=alert(1)>", "1 Cr", "<b>Pune</b>"));
    assert.equal(parsed.listing?.title, "<img src=x onerror=alert(1)>");
    assert.equal(parsed.listing?.location, "<b>Pune</b>");
  });

  it("keeps the original pattern's known limits (documented, not fixed here)", () => {
    // A "|" in the title shifts the fields rather than failing the match...
    const shifted = parseListingTag(tagged(ID, "A | B", "3.25 Cr", "Pune"));
    assert.deepEqual(shifted.listing, { id: ID, title: "A ", price: " B", location: "3.25 Cr|Pune" });
    // ...and an "_" in the location stops it matching, leaving the raw tag in the text.
    const unmatched = parseListingTag(tagged(ID, "T", "1 Cr", "New_Delhi"));
    assert.equal(unmatched.listing, null);
    assert.equal(unmatched.href, null);
    // Either way the id is still checked before it can become a link.
    assert.equal(shifted.href, `/listings/${ID}`);
  });

  it("only the first tag is taken, and only the tag itself is removed", () => {
    const parsed = parseListingTag(`hello ${tagged(ID)} world`);
    assert.equal(parsed.listing?.id, ID);
    assert.equal(parsed.text, "hello \nIs this available? world");
  });
});

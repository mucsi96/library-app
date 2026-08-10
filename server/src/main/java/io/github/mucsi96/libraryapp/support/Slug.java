package io.github.mucsi96.libraryapp.support;

import java.text.Normalizer;
import java.util.Locale;

/** Slug ids derived from names, e.g. "PBZ Sihlcity" becomes "pbz-sihlcity". */
public final class Slug {

  private Slug() {
  }

  public static String slugify(String name) {
    return Normalizer.normalize(name, Normalizer.Form.NFKD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", "-")
        .replaceAll("^-|-$", "");
  }
}

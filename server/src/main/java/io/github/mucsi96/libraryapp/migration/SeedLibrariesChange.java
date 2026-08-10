package io.github.mucsi96.libraryapp.migration;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

import io.github.mucsi96.libraryapp.support.Slug;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

/**
 * Seeds the predefined library list from the branches items were already
 * borrowed from, using the same slug rules as the settings page so ids
 * stay consistent. Spelling variants that collapse into the same slug
 * keep the most frequent name.
 */
public class SeedLibrariesChange implements CustomTaskChange {

  @Override
  public void execute(Database database) throws CustomChangeException {
    JdbcConnection connection = (JdbcConnection) database.getConnection();

    try (
        Statement select = connection.createStatement();
        ResultSet branches = select.executeQuery("""
            SELECT library, COUNT(*) AS items FROM library.loan_items
            WHERE library IS NOT NULL GROUP BY library ORDER BY items DESC, library
            """);
        PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO library.libraries (id, name) VALUES (?, ?)")) {
      Map<String, String> namesBySlug = new LinkedHashMap<>();

      while (branches.next()) {
        String name = branches.getString("library");
        namesBySlug.putIfAbsent(Slug.slugify(name), name);
      }

      for (Map.Entry<String, String> library : namesBySlug.entrySet()) {
        insert.setString(1, library.getKey());
        insert.setString(2, library.getValue());
        insert.addBatch();
      }

      insert.executeBatch();
    } catch (Exception e) {
      throw new CustomChangeException("Failed to seed the library list", e);
    }
  }

  @Override
  public String getConfirmationMessage() {
    return "Seeded the library list from loan item branches";
  }

  @Override
  public void setUp() {
  }

  @Override
  public void setFileOpener(ResourceAccessor resourceAccessor) {
  }

  @Override
  public ValidationErrors validate(Database database) {
    return new ValidationErrors();
  }
}

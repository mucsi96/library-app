package io.github.mucsi96.libraryapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.github.mucsi96.libraryapp.config.DatabaseStartupInitializer;

@SpringBootApplication
public class LibraryAppApplication {

  public static void main(String[] args) {
    final SpringApplication app = new SpringApplication(LibraryAppApplication.class);
    app.addInitializers(new DatabaseStartupInitializer());
    app.run(args);
  }
}

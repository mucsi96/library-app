package io.github.mucsi96.libraryapp.config;

import org.springframework.ai.model.openai.autoconfigure.OpenAiCommonProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

@Configuration
public class AIConfiguration {

  // The official OpenAI SDK (image edits) is configured from the same
  // properties as Spring AI (chat), so one api-key/base-url pair drives both.
  @Bean
  OpenAIClient openAIClient(OpenAiCommonProperties connectionProperties) {
    var clientBuilder = OpenAIOkHttpClient.builder().apiKey(connectionProperties.getApiKey());

    if (connectionProperties.getBaseUrl() != null && !connectionProperties.getBaseUrl().isEmpty()) {
      clientBuilder.baseUrl(connectionProperties.getBaseUrl());
    }

    return clientBuilder.build();
  }
}

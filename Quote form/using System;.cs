using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Xrm.Sdk;
 
namespace Simplify_B1
{
    public class RatingFeedbackPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            ITracingService tracer =
                (ITracingService)serviceProvider.GetService(typeof(ITracingService));
 
            IPluginExecutionContext context =
                (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
 
            IOrganizationServiceFactory factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
 
            IOrganizationService orgService =
                factory.CreateOrganizationService(context.UserId);
 
            tracer.Trace("==== RatingFeedbackPlugin START ====");
 
            try
            {
                // Validate Input
                if (!context.InputParameters.Contains("sb1_foldername") ||
                    context.InputParameters["sb1_foldername"] == null)
                {
                    throw new InvalidPluginExecutionException(
                        "FolderName is required.");
                }
 
                string folderName =
                    context.InputParameters["sb1_foldername"].ToString();
 
                tracer.Trace($"FolderName: {folderName}");
 
                // Get Base URL
                string apiBaseUrl =
                    GetEnvironmentVariable(
                        orgService,
                        "sb1_apibaseurl",
                        tracer);
 
                tracer.Trace($"API Base URL: {apiBaseUrl}");
 
                // Generate Token
                string accessToken =
                    GetAccessToken(orgService, tracer);
 
                tracer.Trace("Token generated successfully.");
 
                // Build API URL
                string requestUrl =
                    $"{apiBaseUrl.TrimEnd('/')}/SalesfeedbackPricing/Feedback?quoteId={Uri.EscapeDataString(folderName)}";
 
                tracer.Trace($"Request URL: {requestUrl}");
 
                // Call API
                using (HttpClient client = new HttpClient())
                {
                    client.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Bearer", accessToken);
 
                    client.Timeout = TimeSpan.FromSeconds(30);
 
                    HttpResponseMessage response =
                        client.GetAsync(requestUrl)
                              .GetAwaiter()
                              .GetResult();
 
                    string rawJson =
                        response.Content.ReadAsStringAsync()
                                .GetAwaiter()
                                .GetResult();
 
                    tracer.Trace($"Raw Response: {rawJson}");

                    tracer.Trace($"HTTP Status: {(int)response.StatusCode}");
                    tracer.Trace($"Raw Response: {rawJson}");
 
                    if (!response.IsSuccessStatusCode)
                    {
                        context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                        context.OutputParameters["sb1_feedbackdata"] = rawJson;
                        return;
                    }
 
                    ParseApiResponse(rawJson, context, tracer);
                }
 
                tracer.Trace("==== RatingFeedbackPlugin END SUCCESS ====");
            }
            catch (Exception ex)
            {
                tracer.Trace("==== PLUGIN ERROR ====");
                tracer.Trace($"Message: {ex.Message}");
                tracer.Trace($"StackTrace: {ex.StackTrace}");
 
                if (ex.InnerException != null)
                {
                    tracer.Trace($"InnerException: {ex.InnerException.Message}");
                }
 
                context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                context.OutputParameters["sb1_feedbackdata"] = ex.Message;
            }
        }
 
        // ── Parse Main API Response ──────────────────────────────────
        private void ParseApiResponse(
            string rawJson,
            IPluginExecutionContext context,
            ITracingService tracer)
        {
            tracer.Trace("==== ParseApiResponse START ====");
 
            try
            {
                if (string.IsNullOrWhiteSpace(rawJson))
{
    tracer.Trace("API returned empty response.");

    context.OutputParameters["sb1_feedbackstatus"] = "Failure";
    context.OutputParameters["sb1_feedbackdata"] =
        "API returned empty response.";

    return;
}
                JsonDocument doc =
                    JsonDocument.Parse(rawJson);
 
                JsonElement root =
                    doc.RootElement;
 
if (!root.TryGetProperty("Result", out JsonElement result))
{
    tracer.Trace("Result node missing.");

    context.OutputParameters["sb1_feedbackstatus"] = "Failure";
    context.OutputParameters["sb1_feedbackdata"] =
        "Result node missing in API response.";

    return;
}
 
                string status =
                    result.GetProperty("Status").GetString() ?? "Failure";
 
                tracer.Trace($"Status: {status}");
 
                // SUCCESS
                if (status.Equals("Success", StringComparison.OrdinalIgnoreCase))
                {
                    if (!result.TryGetProperty("Data", out JsonElement dataArray))
{
    tracer.Trace("Data node missing.");

    context.OutputParameters["sb1_feedbackstatus"] = "Failure";
    context.OutputParameters["sb1_feedbackdata"] =
        "Data node missing.";

    return;
}
 
                    var feedbackList =
                        new List<Dictionary<string, string>>();
 
                    foreach (JsonElement item in dataArray.EnumerateArray())
                    {
                        feedbackList.Add(
                            new Dictionary<string, string>
                            {
                                {
                                    "Date",
                                    item.TryGetProperty("Date", out JsonElement dateEl)
                                        ? dateEl.GetString() ?? ""
                                        : ""
                                },
                                {
                                    "FeedbackSummary",
                                    item.TryGetProperty("FeedbackSummary", out JsonElement feedbackEl)
                                        ? feedbackEl.GetString() ?? ""
                                        : ""
                                },
                                {
                                    "QuoteStatus",
                                    item.TryGetProperty("QuoteStatus", out JsonElement quoteEl)
                                        ? quoteEl.GetString() ?? ""
                                        : ""
                                }
                            });
                    }
 
                    string feedbackJson =
                        JsonSerializer.Serialize(feedbackList);
 
                    tracer.Trace($"Feedback Count: {feedbackList.Count}");
 
                    context.OutputParameters["sb1_feedbackstatus"] = status;
                    context.OutputParameters["sb1_feedbackdata"] = feedbackJson;
                }
                else
                {
                    // FAILURE
                    string message =
                        result.TryGetProperty("Message", out JsonElement msgEl)
                            ? msgEl.GetString() ?? "Unknown error"
                            : "Unknown error";
 
                    tracer.Trace($"Failure Message: {message}");
 
                    context.OutputParameters["sb1_feedbackstatus"] = status;
                    context.OutputParameters["sb1_feedbackdata"] = message;
                }
 
                tracer.Trace("==== ParseApiResponse END ====");
            }
            catch (Exception ex)
            {
                tracer.Trace("==== ParseApiResponse ERROR ====");
                tracer.Trace($"Message: {ex.Message}");
 
                context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                context.OutputParameters["sb1_feedbackdata"] =
                    "Failed to parse API response.";
            }
        }
 
        // ── Token Generation ────────────────────────────────────────
        private string GetAccessToken(
            IOrganizationService orgService,
            ITracingService tracer)
        {
            tracer.Trace("==== GetAccessToken START ====");
 
            try
            {
                string apiBaseUrl =
                    GetEnvironmentVariable(
                        orgService,
                        "sb1_apibaseurl",
                        tracer);
 
                string apiKey =
                    GetEnvironmentVariable(
                        orgService,
                        "sb1_apikey",
                        tracer);
 
                string apiUser =
                    GetEnvironmentVariable(
                        orgService,
                        "sb1_usernamefortoken",
                        tracer);
 
                string apiPassword =
                    GetEnvironmentVariable(
                        orgService,
                        "sb1_tokenpassword",
                        tracer);
 
                string tokenUrl =
                    $"{apiBaseUrl.TrimEnd('/')}/Token?api_key={apiKey}";
 
                tracer.Trace($"Token URL: {tokenUrl}");
 
                using (HttpClient client = new HttpClient())
                {
                    var content =
                        new StringContent(
                            $"grant_type=password&username={apiUser}&password={apiPassword}",
                            Encoding.UTF8,
                            "application/x-www-form-urlencoded");
 
                    HttpResponseMessage response =
                        client.PostAsync(tokenUrl, content)
                              .GetAwaiter()
                              .GetResult();
 
                    string json =
                        response.Content.ReadAsStringAsync()
                                .GetAwaiter()
                                .GetResult();
 
                    tracer.Trace($"Token Response: {json}");
 
                    if (!response.IsSuccessStatusCode)
                    {
                        throw new InvalidPluginExecutionException(
                            $"Token generation failed: {response.ReasonPhrase}");
                    }
 
                    JsonDocument doc =
                        JsonDocument.Parse(json);
 
                    JsonElement root =
                        doc.RootElement;
 
                    if (!root.TryGetProperty("access_token", out JsonElement tokenEl))
                    {
                        throw new InvalidPluginExecutionException(
                            "access_token not found.");
                    }
 
                    string token =
                        tokenEl.GetString();
 
                    tracer.Trace($"Token Length: {token?.Length}");
 
                    return token;
                }
            }
            catch (Exception ex)
            {
                tracer.Trace("==== TOKEN ERROR ====");
                tracer.Trace($"Message: {ex.Message}");
 
                throw new InvalidPluginExecutionException(
                    "Failed to generate token. " + ex.Message);
            }
        }
 
        // ── Environment Variable Reader ─────────────────────────────
        private string GetEnvironmentVariable(
            IOrganizationService orgService,
            string schemaName,
            ITracingService tracer)
        {
            var query =
                new Microsoft.Xrm.Sdk.Query.QueryExpression("environmentvariablevalue")
                {
                    ColumnSet =
                        new Microsoft.Xrm.Sdk.Query.ColumnSet("value")
                };
 
            query.AddLink(
                "environmentvariabledefinition",
                "environmentvariabledefinitionid",
                "environmentvariabledefinitionid"
            ).LinkCriteria.AddCondition(
                "schemaname",
                Microsoft.Xrm.Sdk.Query.ConditionOperator.Equal,
                schemaName
            );
 
            var results =
                orgService.RetrieveMultiple(query);
 
            if (results.Entities.Count > 0 &&
                results.Entities[0].Contains("value"))
            {
                return results.Entities[0]["value"].ToString();
            }
 
            throw new InvalidPluginExecutionException(
                $"Environment variable '{schemaName}' not found.");
        }
    }
}
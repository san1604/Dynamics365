using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;

namespace QuotePlugins
{
    public class RatingFeedbackPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            // ── Boilerplate ──────────────────────────────────────────────
            ITracingService tracer =
                (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            IPluginExecutionContext context =
                (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            IOrganizationServiceFactory factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

            IOrganizationService orgService =
                factory.CreateOrganizationService(context.UserId);

            try
            {
                // ── 1. Read Input Parameter ──────────────────────────────
                if (!context.InputParameters.Contains("sb1_foldername") ||
                    context.InputParameters["FolderName"] == null)
                {
                    throw new InvalidPluginExecutionException("FolderName is required.");
                }

                string folderName = context.InputParameters["sb1_foldername"].ToString();
                tracer.Trace($"FolderName received: {folderName}");

                // ── 2. Retrieve Config from Dataverse ────────────────────
                // Fetch APIBaseUrl from environment variable or config entity
                string apiBaseUrl  = GetEnvironmentVariable(orgService, "sb1_apibaseurl");
                string accessToken = GetAccessToken(orgService, tracer);

                tracer.Trace($"API Base URL: {apiBaseUrl}");

                // ── 3. Call External API ─────────────────────────────────
                string requestUrl =
                    $"{apiBaseUrl.TrimEnd('/')}/SalesfeedbackPricing/Feedback?quoteId={Uri.EscapeDataString(folderName)}";

                tracer.Trace($"Calling URL: {requestUrl}");

                using (HttpClient client = new HttpClient())
                {
                    client.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Bearer", accessToken);

                    client.Timeout = TimeSpan.FromSeconds(30);

                    HttpResponseMessage httpResponse = client.GetAsync(requestUrl).Result;
                    string rawJson = httpResponse.Content.ReadAsStringAsync().Result;

                    tracer.Trace($"HTTP Status: {(int)httpResponse.StatusCode}");
                    tracer.Trace($"Raw Response: {rawJson}");

                    // ── 4. Parse Response ────────────────────────────────
                    if (httpResponse.IsSuccessStatusCode)
                    {
                        ParseSuccessResponse(rawJson, context, tracer);
                    }
                    else
                    {
                        ParseFailureResponse(rawJson, context, tracer);
                    }
                }
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                tracer.Trace($"Unexpected error: {ex.Message}");

                context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                context.OutputParameters["sb1_feedbackdata"]   = ex.Message;
            }
        }

        // ── Success: Result.Status + Result.Data[] ───────────────────────
        private void ParseSuccessResponse(
            string rawJson,
            IPluginExecutionContext context,
            ITracingService tracer)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(rawJson);
                JsonElement root   = doc.RootElement;
                JsonElement result = root.GetProperty("Result");

                string status = result.GetProperty("Status").GetString() ?? "Unknown";
                tracer.Trace($"Feedback Status: {status}");

                if (status.Equals("Success", StringComparison.OrdinalIgnoreCase))
                {
                    // Build feedback list from Result.Data array
                    JsonElement dataArray = result.GetProperty("Data");

                    var feedbackList = new List<Dictionary<string, string>>();

                    foreach (JsonElement item in dataArray.EnumerateArray())
                    {
                        feedbackList.Add(new Dictionary<string, string>
                        {
                            { "Date",            item.GetProperty("Date").GetString()            ?? "" },
                            { "FeedbackSummary", item.GetProperty("FeedbackSummary").GetString() ?? "" },
                            { "QuoteStatus",     item.GetProperty("QuoteStatus").GetString()     ?? "" }
                        });
                    }

                    // Serialize list back to JSON string for Canvas / HTML consumption
                    string feedbackJson = JsonSerializer.Serialize(feedbackList);

                    context.OutputParameters["sb1_feedbackstatus"] = status;
                    context.OutputParameters["sb1_feedbackdata"]   = feedbackJson;

                    tracer.Trace($"Feedback records count: {feedbackList.Count}");
                }
                else
                {
                    // API returned non-Success status inside 200 response
                    string message = result.TryGetProperty("Message", out JsonElement msgEl)
                        ? msgEl.GetString() ?? "Unknown failure"
                        : "API returned non-success status";

                    context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                    context.OutputParameters["sb1_feedbackdata"]   = message;
                }
            }
            catch (Exception ex)
            {
                tracer.Trace($"ParseSuccessResponse error: {ex.Message}");
                context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                context.OutputParameters["sb1_feedbackdata"]   = "Failed to parse API response: " + ex.Message;
            }
        }

        // ── Failure: Result.Status + Result.Message ──────────────────────
        private void ParseFailureResponse(
            string rawJson,
            IPluginExecutionContext context,
            ITracingService tracer)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(rawJson);
                JsonElement root   = doc.RootElement;
                JsonElement result = root.GetProperty("Result");

                string status  = result.GetProperty("Status").GetString()  ?? "Failure";
                string message = result.GetProperty("Message").GetString() ?? "Unknown error";

                context.OutputParameters["sb1_feedbackstatus"] = status;
                context.OutputParameters["sb1_feedbackdata"]   = message;

                tracer.Trace($"Failure - Status: {status}, Message: {message}");
            }
            catch (Exception ex)
            {
                tracer.Trace($"ParseFailureResponse error: {ex.Message}");
                context.OutputParameters["sb1_feedbackstatus"] = "Failure";
                context.OutputParameters["sb1_feedbackdata"]   = rawJson; // return raw on parse error
            }
        }

        // ── Helper: Read Dataverse Environment Variable ──────────────────
        private string GetEnvironmentVariable(IOrganizationService orgService, string schemaName)
        {
            var query = new Microsoft.Xrm.Sdk.Query.QueryExpression("environmentvariablevalue")
            {
                ColumnSet = new Microsoft.Xrm.Sdk.Query.ColumnSet("value")
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

            var results = orgService.RetrieveMultiple(query);

            if (results.Entities.Count > 0 &&
                results.Entities[0].Contains("value"))
            {
                return results.Entities[0]["value"].ToString();
            }

            throw new InvalidPluginExecutionException(
                $"Environment variable '{schemaName}' not found.");
        }

        // ── Helper: Get Bearer Token (calls Token Generation flow/plugin) ─
        private string GetAccessToken(IOrganizationService orgService, ITracingService tracer)
        {
            // Option A: Store token in separate environment variable
            // Option B: Call a shared token plugin/action
            // Below shows environment variable approach:
            try
            {
                return GetEnvironmentVariable(orgService, "sb1_bearertoken");
            }
            catch
            {
                tracer.Trace("Token env variable not found - using token generation plugin");

                // Call token generation custom API
                OrganizationRequest tokenRequest =
                    new OrganizationRequest("quote_generatetoken");

                OrganizationResponse tokenResponse =
                    orgService.Execute(tokenRequest);

                return tokenResponse["AccessToken"].ToString();
            }
        }
    }
}
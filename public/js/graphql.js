export async function fetchUserData(token) {
  try {
    if (!token) {
      token = localStorage.getItem("authToken");
    }

    // No token — tell the caller to log in
    if (!token) {
      throw new Error("No authentication token provided. Please log in first.");
    }

    // Defensive: strip BOM / surrounding whitespace
    token = token.replace(/^\uFEFF/, "").trim();

    // Load the GraphQL query text (user.graphql)
    const queryRes = await fetch("/public/graphql/user.graphql");
    if (!queryRes.ok) {
      throw new Error("GraphQL query file not found");
    }
    const query = await queryRes.text();

    const res = await fetch(
      "https://learn.reboot01.com/api/graphql-engine/v1/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      }
    );

    // Parse response as JSON (server may include error info in JSON)
    let data;
    try {
      data = await res.json();
    } catch (e) {
      const text = await res.text();
      throw new Error(`GraphQL response not JSON: ${text || res.status}`);
    }

    // If GraphQL returned errors, surface them (so callers can detect things like JWTExpired)
    if (data && Array.isArray(data.errors) && data.errors.length > 0) {
      const joined = data.errors.map(err => err.message || JSON.stringify(err)).join("; ");
      throw new Error(joined);
    }

    // If HTTP failed but no GraphQL errors, throw a status message
    if (!res.ok) {
      throw new Error(`Failed to fetch data from GraphQL (status ${res.status})`);
    }

    console.log("GraphQL data:", data);
    return data;
  } catch (err) {
    console.error("fetchUserData error:", err);
    throw err;
  }
}

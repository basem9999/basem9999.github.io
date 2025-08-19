export async function fetchUserData(token) {
  try {
    // 1. If caller didn’t pass a token, try localStorage
    if (!token) {
      token = localStorage.getItem("authToken");
    }

    // 2. Still no token? Bail out early
    if (!token) {
      throw new Error("No authentication token provided. Please log in first.");
    }

    // 3. Trim BOM/whitespace off the token
    token = token.replace(/^\uFEFF/, "").trim();

    // 4. Load your GraphQL query text
    const queryRes = await fetch("/public/graphql/user.graphql");
    if (!queryRes.ok) {
      throw new Error("GraphQL query file not found");
    }
    const query = await queryRes.text();

    // 5. Fire the GraphQL request
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

    // 6. Try to parse JSON body (server may return error info inside JSON)
    let data;
    try {
      data = await res.json();
    } catch (e) {
      // Not JSON — fall back to text
      const text = await res.text();
      throw new Error(`GraphQL response not JSON: ${text || res.status}`);
    }

    // 7. If server sent GraphQL errors, surface those messages
    if (data && Array.isArray(data.errors) && data.errors.length > 0) {
      // join messages so we can detect JWTExpired etc.
      const joined = data.errors.map(err => err.message || JSON.stringify(err)).join("; ");
      throw new Error(joined);
    }

    // 8. If the HTTP status was not OK but there were no GraphQL errors above,
    //    still throw a useful message containing status.
    if (!res.ok) {
      throw new Error(`Failed to fetch data from GraphQL (status ${res.status})`);
    }

    console.log("GraphQL data:", data);
    return data;
  } catch (err) {
    console.error("fetchUserData error:", err);
    // Re-throw for callers to handle (home.js will handle JWTExpired specifically)
    throw err;
  }
}

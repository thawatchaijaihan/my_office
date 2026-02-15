import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = "force-dynamic";

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "gate-pass-713",
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./jaihan-assistant-90c28d13e839.json",
});

interface BillingData {
  currentMonth: {
    total: number;
    services: { name: string; cost: number }[];
  };
  previousMonth: {
    total: number;
  };
  trend: "up" | "down" | "stable";
}

export async function GET(request: NextRequest) {
  try {
    // Get the billing dataset and table name from environment variables
    const billingDataset = process.env.BIGQUERY_BILLING_DATASET || "billing_export";
    const billingTable = process.env.BIGQUERY_BILLING_TABLE || "gcp_billing_export_v1_*";

    // Get current and previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Format dates for BigQuery (YYYY-MM-DD)
    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    // Query for current month costs by service
    const currentMonthQuery = `
      SELECT
        service.description AS service_name,
        SUM(cost) AS total_cost
      FROM
        \`${process.env.GOOGLE_CLOUD_PROJECT_ID || "gate-pass-713"}.${billingDataset}.${billingTable}\`
      WHERE
        DATE(usage_start_time) >= '${formatDate(currentMonthStart)}'
        AND DATE(usage_start_time) <= '${formatDate(now)}'
        AND project.id = '${process.env.GOOGLE_CLOUD_PROJECT_ID || "gate-pass-713"}'
      GROUP BY
        service_name
      ORDER BY
        total_cost DESC
    `;

    // Query for previous month total
    const previousMonthQuery = `
      SELECT
        SUM(cost) AS total_cost
      FROM
        \`${process.env.GOOGLE_CLOUD_PROJECT_ID || "gate-pass-713"}.${billingDataset}.${billingTable}\`
      WHERE
        DATE(usage_start_time) >= '${formatDate(previousMonthStart)}'
        AND DATE(usage_start_time) <= '${formatDate(previousMonthEnd)}'
        AND project.id = '${process.env.GOOGLE_CLOUD_PROJECT_ID || "gate-pass-713"}'
    `;

    // Execute queries
    const [currentMonthRows] = await bigquery.query({ query: currentMonthQuery });
    const [previousMonthRows] = await bigquery.query({ query: previousMonthQuery });

    // Process results
    const services = currentMonthRows.map((row: any) => ({
      name: row.service_name || "Unknown",
      cost: parseFloat(row.total_cost || 0),
    }));

    const currentTotal = services.reduce((sum, s) => sum + s.cost, 0);
    const previousTotal = parseFloat(previousMonthRows[0]?.total_cost || 0);

    // Calculate trend
    let trend: "up" | "down" | "stable" = "stable";
    if (currentTotal > previousTotal * 1.1) trend = "up";
    else if (currentTotal < previousTotal * 0.9) trend = "down";

    const billingData: BillingData = {
      currentMonth: {
        total: currentTotal,
        services,
      },
      previousMonth: {
        total: previousTotal,
      },
      trend,
    };

    return NextResponse.json(billingData);
  } catch (error) {
    console.error("Billing API Error:", error);
    
    // Return mock data if BigQuery is not set up yet
    const mockData: BillingData = {
      currentMonth: {
        total: 0,
        services: [
          { name: "Cloud Functions", cost: 0 },
          { name: "App Hosting", cost: 0 },
          { name: "Firebase", cost: 0 },
        ],
      },
      previousMonth: {
        total: 0,
      },
      trend: "stable",
    };

    return NextResponse.json({
      ...mockData,
      error: "BigQuery billing export not configured. Please set up billing export in Google Cloud Console.",
      isDemo: true,
    });
  }
}

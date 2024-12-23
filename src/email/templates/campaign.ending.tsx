import React, { CSSProperties } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
  Img,
} from "@react-email/components";
import { Campaign } from "../../util/global";

const CampaignEndingEmail = ({
  userFirstName = "Hạnh",
  userLastName = "Vương Sỹ",
  campaign,
}: {
  userFirstName: string;
  userLastName: string;
  campaign: Campaign;
}) => {
  const timeRemaining = campaign.endAt.getTime() - new Date().getTime();
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  return (
    <Html>
      <Head />
      <Preview>
        Don't miss out! Campaign "{campaign.name}" is ending soon on KGB Hub!
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <Link
              href="https://kgb-hub.harmoury.space"
              style={styles.headerLink}
            >
              <img
                src="https://i.imgur.com/spX3OOe.png"
                alt="KGB Hub Logo"
                style={styles.logo}
              />
              <p style={styles.brandName}>KGB Hub</p>
            </Link>
          </div>

          {/* Hero Image */}
          <Img
            src="https://i.pinimg.com/736x/e8/4c/d4/e84cd4171021676a02f78d04288b2cb0.jpg"
            width="280"
            height="auto"
            alt="Campaign Ending Soon"
            style={styles.heroImage}
          />

          {/* Greeting */}
          <Text style={styles.greeting}>
            Dear{" "}
            <strong>
              {userFirstName} {userLastName}
            </strong>
            ,
          </Text>

          <Text style={styles.paragraph}>
            We wanted to remind you that our campaign "
            <strong>{campaign.name}</strong>" is ending soon! Don't miss out on
            these amazing offers.
          </Text>

          {/* Campaign Details Section */}
          <div style={styles.orderDetailsContainer}>
            <Text style={styles.sectionTitle}>Campaign Details:</Text>

            <div style={styles.detailsGrid}>
              <div style={styles.detailRow}>
                <span>Campaign Name:</span>
                <span style={styles.detailValue}>{campaign.name}</span>
              </div>

              <div style={styles.detailRow}>
                <span>Time Remaining:</span>
                <span style={styles.detailValue}>
                  {" "}
                  {days} days {hours} hours {minutes} minutes
                </span>
              </div>

              <div style={styles.detailRow}>
                <span>End Date:</span>
                <span style={styles.detailValue}>
                  {campaign.endAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <Text style={styles.paragraph}>
            <strong>Hurry!</strong> These offers won't last long. Visit KGB Hub
            now to take advantage of these amazing deals before they expire.
          </Text>

          {campaign.description && (
            <Text style={styles.paragraph}>
              <strong>Campaign Details:</strong>
              <br />
              {campaign.description}
            </Text>
          )}

          <Text style={styles.paragraph}>
            Don't hesitate to contact our support team if you have any questions
            about the campaign or available vouchers.
          </Text>

          <Text style={styles.signature}>
            Best regards,
            <br />
            <strong>KGB Hub Team</strong>
          </Text>

          {/* Footer */}
          <div style={styles.footer}>
            Copyright © 2024 KGB Hub. All rights reserved.
          </div>
        </Container>
      </Body>
    </Html>
  );
};

const styles = {
  main: {
    backgroundColor: "#ffffff",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    color: "#1a1a1a",
  } as CSSProperties,
  container: {
    padding: "0",
    maxWidth: "600px",
    margin: "0 auto",
  } as CSSProperties,
  header: {
    backgroundColor: "#2563eb",
    padding: "16px 24px",
    marginBottom: "24px",
  } as CSSProperties,
  headerLink: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    gap: "12px",
  } as CSSProperties,
  logo: {
    height: "26px",
    objectFit: "cover" as const,
  } as CSSProperties,
  brandName: {
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: "600",
    margin: "0",
  } as CSSProperties,
  heroImage: {
    display: "block",
    margin: "0 auto 32px",
    width: "280px",
  } as CSSProperties,
  greeting: {
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 24px 16px",
  } as CSSProperties,
  paragraph: {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#374151",
    margin: "0 24px 16px",
  } as CSSProperties,
  orderDetailsContainer: {
    margin: "24px",
    padding: "24px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    backgroundColor: "#f9fafb",
  } as CSSProperties,
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "16px",
    color: "#111827",
  } as CSSProperties,
  detailsGrid: {
    display: "grid",
    gap: "12px",
  } as CSSProperties,
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    padding: "4px 0",
  } as CSSProperties,
  detailValue: {
    fontWeight: "500",
    color: "#111827",
  } as CSSProperties,
  voucherSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "12px",
    marginTop: "12px",
  } as CSSProperties,
  voucherTitle: {
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: "8px",
  } as CSSProperties,
  discountSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "12px",
    marginTop: "12px",
  } as CSSProperties,
  signature: {
    fontSize: "16px",
    lineHeight: "24px",
    margin: "32px 24px 24px",
  } as CSSProperties,
  footer: {
    backgroundColor: "#f3f4f6",
    padding: "16px",
    textAlign: "center",
    fontSize: "14px",
    color: "#6b7280",
  } as CSSProperties,
};

export default CampaignEndingEmail;

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
import { Order } from "../../util/global";
import { ProductType } from "@prisma/client";

const PaymentSuccessEmail = ({
  userFirstName = "Hạnh",
  userLastName = "Vương Sỹ",
  order,
}: {
  userFirstName: string;
  userLastName: string;
  order: Order;
}) => (
  <Html>
    <Head />
    <Preview>
      Thank you for your purchase on KGB Hub! Your payment was successful.
    </Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link href="https://kgb-hub.harmoury.space" style={styles.headerLink}>
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
          src="https://img.freepik.com/free-vector/successful-purchase-concept-illustration_114360-1003.jpg"
          width="280"
          height="auto"
          alt="Payment Success"
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
          Thank you for your purchase on KGB Hub! We're excited to confirm that
          your payment has been successfully processed.
        </Text>

        {/* Order Details Section */}
        <div style={styles.orderDetailsContainer}>
          <Text style={styles.sectionTitle}>Order Details:</Text>

          <div style={styles.detailsGrid}>
            <div style={styles.detailRow}>
              <span>Order ID: </span>
              <span style={styles.detailValue}>{order.id}</span>
            </div>
            <div style={styles.detailRow}>
              <span>Date: </span>
              <span style={styles.detailValue}>
                {order.updatedAt.toString()}
              </span>
            </div>

            {/* Products */}
            {order.productOrders.map((po) => {
              if (po.product.type === ProductType.COURSE) {
                return (
                  <div key={po.id} style={styles.courseSection}>
                    <div style={styles.courseName}>
                      <strong>Course: </strong>
                      <div style={styles.courseNameText}>{po.product.name}</div>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Course Price: </span>
                      <span style={styles.detailValue}>
                        ${po.price.toFixed(2)} {po.product.currency}
                      </span>
                    </div>
                  </div>
                );
              } else if (po.product.type === ProductType.STRIPE_SERVICE_FEE) {
                return (
                  <div key={po.id} style={styles.detailRow}>
                    <span style={styles.serviceFee}>Service Fee:</span>
                    <span style={styles.detailValue}>
                      ${po.price.toFixed(2)} {po.product.currency}
                    </span>
                  </div>
                );
              }
              return null;
            })}

            {/* Total */}
            <div style={styles.totalRow}>
              <strong>Total Amount: </strong>
              <strong>
                $
                {order.productOrders
                  .reduce((a, b) => a + b.price, 0)
                  .toFixed(2)}{" "}
                {order.currency}
              </strong>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <Text style={styles.paragraph}>
          You can now access your course by logging into your KGB Hub account.
          All course materials and resources are available in your learning
          dashboard.
        </Text>

        <Text style={styles.paragraph}>
          If you have any questions about the course or need technical
          assistance, our support team is here to help. You can reach us through
          our support portal on KGB Hub.
        </Text>

        <Text style={styles.paragraph}>Happy learning!</Text>

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
  courseSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "12px",
    marginTop: "12px",
  } as CSSProperties,
  courseName: {
    marginBottom: "8px",
  } as CSSProperties,
  courseNameText: {
    marginLeft: "16px",
    marginTop: "4px",
    color: "#4b5563",
  } as CSSProperties,
  serviceFee: {
    color: "#6b7280",
  } as CSSProperties,
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    marginTop: "12px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "16px",
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

export default PaymentSuccessEmail;

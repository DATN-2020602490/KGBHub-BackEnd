import React, { SVGProps } from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Tailwind,
  Text,
  Img,
} from '@react-email/components';

const RejectForm = ({ userFirstName = 'User' }) => (
  <Html>
    <Head />
    <Preview>Verify your account</Preview>
    <Tailwind>
      <Body className={main}>
        <Container className={container} style={{ maxWidth: 'unset' }}>
          <div className="bg-blue-500 px-4 mb-2 relative">
            <Link
              href="https://dkelearning.vercel.app"
              className="flex text-white gap-x-2"
              style={{ display: 'flex' }}
            >
              <img
                src="https://i.imgur.com/spX3OOe.png"
                alt=""
                className="absolute top-2/4 -translate-y-2/4"
                style={{ height: '26px', objectFit: 'cover' }}
              />
              <p className="ml-10 font-semibold text-lg leading-none">
                Dang Khai
              </p>
            </Link>
          </div>
          <Img
            src="https://img.freepik.com/premium-vector/document-error-icon-comic-style-broken-report-cartoon-vector-illustration-white-isolated-background-damaged-splash-effect-business-concept_157943-6937.jpg"
            width="0"
            height="0"
            sizes="1000px"
            alt=""
            className="block object-cover w-[280px] h-auto mx-auto"
          />
          <Text className="text-start text-dm">
            Dear <b>{userFirstName}</b>,
          </Text>
          <Text className="text-start text-dm">
            Thank you for your interest in the <b>Instructor</b> position at{' '}
            <b>Dang Khai Education</b>. We appreciate you taking the time to
            apply and share your qualifications with us.
          </Text>
          <Text className="text-start text-dm">
            We were very impressed with your background and experience, and we
            believe you have the potential to be a valuable asset to our
            institution. However, after careful consideration, we have decided
            to move forward with other candidates whose qualifications and
            experience more closely align with the specific requirements of this
            position.
          </Text>
          <Text className="text-start text-dm">
            We encourage you to keep an eye on our careers page for future
            opportunities that may be a better fit for your skills and
            experience. You may also reapply for this position in{' '}
            <b>
              <i>15 days</i>
            </b>{' '}
            if you believe your qualifications and experience have changed in
            that time.
          </Text>
          <Text className="text-start text-dm">
            Thank you again for your interest in <b>Dang Khai Education</b>. We
            wish you the best of luck in your job search.
          </Text>
          <Text className="text-start text-dm">
            Sincerely,
            <br />
            <b>Dang Khai Education</b>
          </Text>
          <div className="bg-slate-300 py-4 mt-4 text-sm  text-center">
            Copyright © 2024 Dang Khai Education. All rights reserved.
          </div>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default RejectForm;

const main = `bg-white font-['-apple-system,BlinkMacSystemFont,"Segoe_UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica_Neue",sans-serif'] text-black`;
// const container = 'p-5 pb-12 w-[60%]';
const container = 'p-5 pb-12 px-15 max-w-screen-sm';
const paragraph = 'text-base leading-[26px] text-start';

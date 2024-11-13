import React from 'react';
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

const Welcome = ({ userFirstName = 'User' }) => (
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
          <Text className="text-start text-dm">
            Dear <b>{userFirstName}</b>,
          </Text>
          <Text className="text-start text-base">
            You've joined the <b>Dang Khai</b> elearning community through
            Gmail.
          </Text>
          <Img
            src="https://static.vecteezy.com/system/resources/previews/016/140/559/original/cartoon-welcome-ribbon-icon-in-comic-style-hello-sticker-label-sign-illustration-pictogram-welcome-tag-business-splash-effect-concept-vector.jpg"
            width="0"
            height="0"
            sizes="1000px"
            alt=""
            className="block object-cover w-[280px] h-auto mx-auto"
          />
          <Text className="text-start text-base">
            At <b>Dang Khai Education</b>, we are committed to providing you
            with the best possible learning experience. We offer a wide range of
            courses, from basic skills to advanced programs, all designed to
            help you achieve your goals.
          </Text>
          <Text className="text-start text-base">
            Our experienced and dedicated instructors are passionate about
            teaching and are committed to helping you succeed. They will provide
            you with the support and guidance you need to reach your full
            potential.
          </Text>

          <Link
            className="block text-base mx-auto w-fit px-8 py-3 bg-blue-500 text-white font-semibold rounded-md"
            href="https://dkelearning.vercel.app"
          >
            Go to Home page
          </Link>
          <Text className="text-start text-base">
            We are confident that you will have a positive and rewarding
            experience at <b>Dang Khai Education</b>. We encourage you to get
            involved in our campus community and take advantage of all that we
            have to offer.
          </Text>
          <Text className="text-start text-dm">
            Sincerely,
            <br />
            <b>Dang Khai Education</b>
          </Text>
          <div className="bg-slate-300 py-4 mt-4 text-sm text-center">
            Copyright © 2024 Dang Khai Education. All rights reserved.
          </div>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default Welcome;

const main = `bg-white font-['-apple-system,BlinkMacSystemFont,"Segoe_UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica_Neue",sans-serif'] text-black`;
// const container = 'p-5 pb-12 w-[60%]';
const container = 'p-5 pb-12 px-15 max-w-screen-sm';
const paragraph = 'text-base leading-[26px] text-start';

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

const ResetPassword = ({ newPassword = 'Jjr3#cng@!' }) => (
  <Html>
    <Head />
    <Preview>Reset password</Preview>
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
            src="https://png.pngtree.com/png-vector/20230122/ourmid/pngtree-comic-laptop-with-password-icon-on-white-background-vector-png-image_49383650.jpg"
            width="0"
            height="0"
            sizes="1000px"
            alt=""
            className="block object-cover w-[280px] h-auto mx-auto"
          />
          <Text className="text-base">Your new password:</Text>
          <Text className="text-base font-semibold">{newPassword}</Text>

          <div className="bg-slate-300 py-4 mt-4 text-sm text-center">
            Copyright © 2024 Dang Khai Education. All rights reserved.
          </div>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default ResetPassword;

const main = `bg-white font-['-apple-system,BlinkMacSystemFont,"Segoe_UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica_Neue",sans-serif'] text-black`;
// const container = 'p-5 pb-12 w-[60%]';
const container = 'p-5 pb-12 px-15 max-w-screen-sm';
const paragraph = 'text-base leading-[26px] text-start';

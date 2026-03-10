"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Navbar as HeroUINavbar, NavbarBrand, NavbarContent } from "@heroui/navbar";

import { subtitle } from "./primitives";

import { siteConfig } from "@/config/site";

export const Navbar = () => {
  const [currentDateTime, setCurrentDateTime] = useState<{
    date: string;
    time: string;
  }>({ date: "", time: "" });

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();

      setCurrentDateTime({
        date: now.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        time: now.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <HeroUINavbar className="bg-white py-4" maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1 " href="/">
            <Image
              alt="Logo"
              className="object-contain"
              height={80}
              src="/images/Logo.bmp"
              width={80}
            />
            <div>
              <p className={subtitle({ class: "text-2xl font-bold" })}>{siteConfig.name}</p>
              <p className={subtitle({ class: "text-sm text-default-500" })}>{siteConfig.description}</p>
            </div>
          </NextLink>
        </NavbarBrand>
        {/* <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </div> */}
      </NavbarContent>

      {/* <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <Link isExternal href={siteConfig.links.twitter} title="Twitter">
            <TwitterIcon className="text-default-500" />
          </Link>
          <Link isExternal href={siteConfig.links.discord} title="Discord">
            <DiscordIcon className="text-default-500" />
          </Link>
          <Link isExternal href={siteConfig.links.github} title="GitHub">
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
        <NavbarItem className="hidden md:flex">
          <Button
            isExternal
            as={Link}
            className="text-sm font-normal text-default-600 bg-default-100"
            href={siteConfig.links.sponsor}
            startContent={<HeartFilledIcon className="text-danger" />}
            variant="flat"
          >
            Sponsor
          </Button>
        </NavbarItem>
      </NavbarContent> */}

      <NavbarContent className="basis-1 pl-4" justify="end">
        {currentDateTime.date && currentDateTime.time ? (
          <p>
            ข้อมูล ณ วันที่ {currentDateTime.date} เวลา {currentDateTime.time}
          </p>
        ) : (
          <p>ข้อมูล ณ วันที่ - เวลา -</p>
        )}
        {/* <Link isExternal href={"#"}>
          <GithubIcon className="text-default-500" />
        </Link> */}
        {/* <ThemeSwitch /> */}
        {/* <NavbarMenuToggle /> */}
      </NavbarContent>

      {/* <NavbarMenu>
        {searchInput}
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu> */}
    </HeroUINavbar>
  );
};

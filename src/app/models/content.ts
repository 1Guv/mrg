export interface Content {
    header?: Header;
    homeCTA?: HomeCTA;
    footer?: Footer;
    // createListing?: CreateListing;
    // search?: Search;
}

export interface Header {
    leftLogoUrl: string;
    middleLogoUrl: string;
    headerMenuOptions: Array<HeaderMenuOptions>;
}

export interface HeaderMenuOptions {
    name: string;
    icon: string;
    url: string;
    toolTip: string;
}

export interface HomeCTA {
    mainMessage: string;
    subMessage: string;
    registerButton: CTAButtons;
    getAmexButton: CTAButtons;
    calculateButton: CTAButtons;
    reviewButton: CTAButtons;
    howItWorks: Array<Section>;
}

export interface CTAButtons {
    name: string;
    url: string;
}

export interface Section {
    subTitle: string;
    title: string;
    paragraph: string;
    list: Array<List>;
    imageLeft: boolean;
    imageRight: boolean;
    imageUrl: string;
    ctaButtonText: string;
    ctaButtonUrl: string;
    ctaButtonSubText: string;
}

export interface List {
    listTitle: string;
    listIcon: string;
}

export interface Footer {
    heading: string;
    ctaButtons: Array<CTAButtons>;
    logo: string;
    address: string;
    email: string;
    socialMedia: Array<SocialMedia>;
    company: Array<CompanyLinks>;
    help: Array<CompanyLinks>;
}

export interface SocialMedia {
    name: string;
    icon: string;
    url: string;
}

export interface CompanyLinks {
    name: string;
    url: string;
}

import { default as axios } from "axios";
import * as querystring from "querystring";
import {
  TeamsActivityHandler,
  CardFactory,
  TurnContext,
  AdaptiveCardInvokeValue,
  AdaptiveCardInvokeResponse,
  ConversationReference,
  Activity,
  ChannelInfo,
  TeamInfo,
  MessageFactory,
} from "botbuilder";
import rawWelcomeCard from "./adaptiveCards/welcome.json";
import rawLearnCard from "./adaptiveCards/learn.json";
import rawProfesorPocetna from "./adaptiveCards/profesor_pocetna.json"
import rawProfesorRed from "./adaptiveCards/profesor_red_odgovaranja.json"
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import { getInfoFromTable } from "./SheetsFunctions";
import {kreirajOdgovaranje,preuzmiInformacijeOdgovaranja, toggleOmoguceno} from "./adaptivneFunkcije";
export interface DataInterface {
  likeCount: number;
}
export interface TabelaKorisnika {
  vrednosti : string[],
  omoguceno : string
}
interface Korisnik{
  korisnik : string;
  id : string;
  tid : string;
  cid : string;
};
interface ConvActiv{
  conv : Partial<ConversationReference>;
  act : Activity;
};
export class TeamsBot extends TeamsActivityHandler {
  // record the likeCount
  likeCountObj: { likeCount: number };
  conversationReferenceList: ConvActiv[];
  constructor() {
    super();
    this.likeCountObj = { likeCount: 0 };
    this.conversationReferenceList = [];
    

    this.onMessage(async (context, next) => {
      console.log("Running with Message Activity.");

      let txt = context.activity.text;
      const removedMentionText = TurnContext.removeRecipientMention(context.activity);
      if (removedMentionText) {
        // Remove the line break
        txt = removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim();
      }

      // Trigger command by IM text
      switch (txt) {
        case "welcome": {
          const card = AdaptiveCards.declareWithoutData(rawProfesorPocetna).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
        case "learn": {
          this.likeCountObj.likeCount = 0;
          const card = AdaptiveCards.declare<DataInterface>(rawLearnCard).render(this.likeCountObj);
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
        case "podaci":{
          let sheet = await getInfoFromTable("1BLF6J_ORoPdsw_V868zrAI6TVLDsbn9ewSU9WlGolD4");
          let data = sheet.data.values;
          let odgovor = data[0][0] + " " + data[0][1] + " " + data[0][2] + " " + data[0][3] + " " + data[0][4] + "\n";
          data.forEach((e, i) => {
            if(i != 0){
              odgovor += data[i][0] + " " + data[i][1] + " " + data[i][2] + " " + data[i][3] + " " + data[i][4] + "\n";
            }
          });
          await context.sendActivity(odgovor);
          break;
        }
        case "sledeci":{
          let sheet = await getInfoFromTable("1BLF6J_ORoPdsw_V868zrAI6TVLDsbn9ewSU9WlGolD4");
          let data = sheet.data.values;
          let student = undefined;
          data.forEach((e, i)=>{
            if(!student && e[4] == "FALSE"){
              student = e[0] + " "+ e[1] + " " + e[2] + " " + e[3]
            }
          });
          await context.sendActivity("Sledeci student je : " + student);
          break;
        } case "dodaj":{
          let user = context.activity.from.name;
          let userID = context.activity.from.aadObjectId;
          let conversationID = context.activity.conversation.id;
          //let tID = context.activity.channelData.Tenant.Id;
          let kor : Korisnik;
          kor = {korisnik : user, id : userID, cid : conversationID, tid : JSON.stringify(context.activity.channelData)};
          
          //this.listaKorisnika.push(kor);
          const convref = TurnContext.getConversationReference(context.activity);
          let a : ConvActiv= {conv : convref, act : context.activity};
          this.conversationReferenceList.push(a);

          await context.sendActivity(`Ime : ${user}`);
          await context.sendActivity(`ID : ${userID}`);
          await context.sendActivity(`Conversation id :  ${conversationID}`);
          await context.sendActivity(`Tenant id :  ${JSON.stringify(context.activity.channelData)}`);
          break;
        } case "obavesti":{
          await this.messageAllMembersAsync(context);
          break;
        }
        default:{
          await context.sendActivity("I don't realy understand you!");
          break;
        }
      }

      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });
    
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id) {
          const card = AdaptiveCards.declareWithoutData(rawWelcomeCard).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
      }
      await next();
    });

    this.onTeamsChannelCreated(async (channelInfo: ChannelInfo, teamInfo: TeamInfo, turnContext : TurnContext, next: ()=> Promise<void>): Promise<void> =>{
      const message = MessageFactory.text("Ja sam mala zaba");
      await turnContext.sendActivity(message);
      await next();
    });
  }
  
  async messageAllMembersAsync(context : TurnContext) {
   await this.conversationReferenceList.forEach(async cr =>{
    context.adapter.continueConversation(cr.conv, async(contextn : TurnContext)=>{
      await contextn.sendActivity("ZABAAAAAAAAAA");
    });
   });
    await context.sendActivity(MessageFactory.text('All messages have been sent.'));
  }
  // Invoked when an action is taken on an Adaptive Card. The Adaptive Card sends an event to the Bot and this
  // method handles that event.
  async onAdaptiveCardInvoke(
    context: TurnContext,
    invokeValue: AdaptiveCardInvokeValue
  ): Promise<AdaptiveCardInvokeResponse> {
    // The verb "userlike" is sent from the Adaptive Card defined in adaptiveCards/learn.json
    if (invokeValue.action.verb === "userlike") {
      this.likeCountObj.likeCount++;
      const card = AdaptiveCards.declare<DataInterface>(rawLearnCard).render(this.likeCountObj);
      await context.updateActivity({
        type: "message",
        id: context.activity.replyToId,
        attachments: [CardFactory.adaptiveCard(card)],
      });
      return { statusCode: 200, type: undefined, value: undefined };
    }
    if(invokeValue.action.verb === "kreairajOdogovaranje"){
        let id = await kreirajOdgovaranje();

        let odg : TabelaKorisnika;
        odg = {
          vrednosti : ["asdasd",
          "1232131",
          "Pralina Pralinic",
          "asdasd",
          "1232131",
          "Pralina Pralinic",
          "asdasd",
          "1232131",
          "Pralina Pralinic",
          "asdasd",
          "1232131",
          "Pralina Pralinic",
          "asdasd",
          "1232131",
          "Pralina Pralinic"],
          omoguceno : "TRUE"
        };

        const card = AdaptiveCards.declare<TabelaKorisnika>(rawProfesorRed).render(odg);
        await context.updateActivity({
          type: "message",
          id: context.activity.replyToId,
          attachments: [CardFactory.adaptiveCard(card)],
        });
        return { statusCode: 200, type: undefined, value: undefined };
    }
    if(invokeValue.action.verb === "obavestiSledeceg"){
      let data = await preuzmiInformacijeOdgovaranja("");
      console.log(data)
      let student = undefined;
      data.forEach((e, i)=>{
        if(!student && e[4] == "FALSE"){
          student = e[0] + " "+ e[1] + " " + e[2] + " " + e[3]
        }
      });
      await context.sendActivity("Sledeci student je : " + student);
      return { statusCode: 200, type: undefined, value: undefined };
  }
    if(invokeValue.action.verb === "omoguci"){
      let omoguci = await toggleOmoguceno();
      let vrednost = {
        vrednosti : ["zaa", "zaa", "zaa", "zaa","zaa","zaa","zaa","zaa","zaa","zaa","zaa","zaa","zaa","zaa","zaa"],
        omoguceno : omoguci
      }
      const card = AdaptiveCards.declare<TabelaKorisnika>(rawProfesorRed).render(vrednost);
      await context.updateActivity({
        type: "message",
        id: context.activity.replyToId,
        attachments: [CardFactory.adaptiveCard(card)],
      });
      return { statusCode: 200, type: undefined, value: undefined };
    }
  }

  // Message extension Code
  // Action.
  public async handleTeamsMessagingExtensionSubmitAction(
    context: TurnContext,
    action: any
  ): Promise<any> {
    switch (action.commandId) {
      case "createCard":
        return createCardCommand(context, action);
      case "shareMessage":
        return shareMessageCommand(context, action);
      default:
        throw new Error("NotImplemented");
    }
  }

  // Search.
  public async handleTeamsMessagingExtensionQuery(context: TurnContext, query: any): Promise<any> {
    const searchQuery = query.parameters[0].value;
    const response = await axios.get(
      `http://registry.npmjs.com/-/v1/search?${querystring.stringify({
        text: searchQuery,
        size: 8,
      })}`
    );

    const attachments = [];
    response.data.objects.forEach((obj) => {
      const heroCard = CardFactory.heroCard(obj.package.name);
      const preview = CardFactory.heroCard(obj.package.name);
      preview.content.tap = {
        type: "invoke",
        value: { name: obj.package.name, description: obj.package.description },
      };
      const attachment = { ...heroCard, preview };
      attachments.push(attachment);
    });

    return {
      composeExtension: {
        type: "result",
        attachmentLayout: "list",
        attachments: attachments,
      },
    };
  }

  public async handleTeamsMessagingExtensionSelectItem(
    context: TurnContext,
    obj: any
  ): Promise<any> {
    return {
      composeExtension: {
        type: "result",
        attachmentLayout: "list",
        attachments: [CardFactory.heroCard(obj.name, obj.description)],
      },
    };
  }

  // Link Unfurling.
  public async handleTeamsAppBasedLinkQuery(context: TurnContext, query: any): Promise<any> {
    const attachment = CardFactory.thumbnailCard("Image Preview Card", query.url, [query.url]);

    const result = {
      attachmentLayout: "list",
      type: "result",
      attachments: [attachment],
    };

    const response = {
      composeExtension: result,
    };
    return response;
  }
}

async function createCardCommand(context: TurnContext, action: any): Promise<any> {
  // The user has chosen to create a card by choosing the 'Create Card' context menu command.
  const data = action.data;
  const heroCard = CardFactory.heroCard(data.title, data.text);
  heroCard.content.subtitle = data.subTitle;
  const attachment = {
    contentType: heroCard.contentType,
    content: heroCard.content,
    preview: heroCard,
  };

  return {
    composeExtension: {
      type: "result",
      attachmentLayout: "list",
      attachments: [attachment],
    },
  };
}

async function shareMessageCommand(context: TurnContext, action: any): Promise<any> {
  // The user has chosen to share a message by choosing the 'Share Message' context menu command.
  let userName = "unknown";
  if (
    action.messagePayload &&
    action.messagePayload.from &&
    action.messagePayload.from.user &&
    action.messagePayload.from.user.displayName
  ) {
    userName = action.messagePayload.from.user.displayName;
  }

  // This Message Extension example allows the user to check a box to include an image with the
  // shared message.  This demonstrates sending custom parameters along with the message payload.
  let images = [];
  const includeImage = action.data.includeImage;
  if (includeImage === "true") {
    images = [
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtB3AwMUeNoq4gUBGe6Ocj8kyh3bXa9ZbV7u1fVKQoyKFHdkqU",
    ];
  }
  const heroCard = CardFactory.heroCard(
    `${userName} originally sent this message:`,
    action.messagePayload.body.content,
    images
  );

  if (
    action.messagePayload &&
    action.messagePayload.attachment &&
    action.messagePayload.attachments.length > 0
  ) {
    // This sample does not add the MessagePayload Attachments.  This is left as an
    // exercise for the user.
    heroCard.content.subtitle = `(${action.messagePayload.attachments.length} Attachments not included)`;
  }

  const attachment = {
    contentType: heroCard.contentType,
    content: heroCard.content,
    preview: heroCard,
  };

  return {
    composeExtension: {
      type: "result",
      attachmentLayout: "list",
      attachments: [attachment],
    },
  };
}

import { useEffect, useState } from "react";
import { FlatList, Pressable, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import * as Contacts from 'expo-contacts';
import IconLibrary from "@/misc/helpers/icons";
import { deletePersonalContact, fetchData, getContacts } from "@/misc/helpers/db";
import Buttons from "@/components/ButtonComp";
import PhoneBook from "@/misc/store/phonebook";
import { shortenPub } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import AddContactSheet from "@/components/Sheets/AddContactSheet";
import PersonalContacts from "@/misc/store/personalcontacts";
import WalletItem from "@/misc/store/wallet";
import ConfirmActionSheet from "@/components/Sheets/ConfirmationSheet";
import { useAi } from "@/misc/context/AiContext";

function getMatchingContacts(phoneContacts: any, heysolanaContacts: any) {
  const phoneC = new Set(phoneContacts.map((item: any) => item.phoneNumbers && item.phoneNumbers[0]?.number?.replace(/[-\s]/g, '')).filter(Boolean));

  // Find matches and return formatted data
  return heysolanaContacts
    .filter((target: any) => [...phoneC].some((num: any) => num.includes(target.phone_number)))
    .map((matchedItem: any) => ({
      name: matchedItem.username,
      phoneNumber: matchedItem.phone_number,
      walletAddress: matchedItem.wallet_address,
    }));
}

/**
  * What should be done here
  * 1. Add user to Address Book  and Shows List of Contact in Address Book and What to Change
  */
function AddressBook() {

  const { setLoading, isLoading, setToast } = AppSettings()
  const { publicKey } = WalletItem()


  const [users, setUsers] = useState<any>([]);
  const [contactsPhone, setContactsPhone] = useState<any[]>([])
  const [contactsOnHeySolana, setContactsOnHeySolana] = useState<any[]>([])
  const [showContactonHey, setShowContactOnHey] = useState(true)

  const { contacts, addContact } = PhoneBook();
  const { personalContacts, addPersonalContact, deletePersonalContact:deleteAppContact, refreshPersonalContacts } = PersonalContacts();

  const { refresher } = AppSettings()

  const [addContactModal, setAddContactModal] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [selectedContact, setSelectedContact] = useState<any>(null)


  useEffect(() => {
    getPersonalContacts()

    mathchingContacts()
  }, [contactsPhone, users, refresher])


  const mathchingContacts = () => {
    if (contactsPhone.length > 0 && users.length > 0) {
      const items = getMatchingContacts(contactsPhone, users)
      items?.forEach((item: any) => {
        const contactFetched = {
          name: item.name as string,
          phoneNumber: item.phoneNumber as string,
          walletAddress: item.walletAddress as string,
        }
        addContact(contactFetched)
      })
      setContactsOnHeySolana(items)
    } else {
      setContactsOnHeySolana(contacts)
    }
  }


  const getPersonalContacts = async () => {
    const response = await getContacts(publicKey?.toString() || "")
    if (response?.status) {
      
      if(response.data.data?.length <= 0){
        refreshPersonalContacts()
      }

      response.data.data?.forEach((item: any) => {
        const contactFetched = {
          id: item.id as string,
          name: item.username as string,
          phoneNumber: item.mobile_number as string,
          walletAddress: item.wallet_address as string,
          type: "personal"
        }
        addPersonalContact(contactFetched)
      })
    }else{
      refreshPersonalContacts()
    }
  }

  const fetchContacts = async () => {
    setLoading(true)
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data.length > 0) {
        const contact = data.filter((item) => item.name.trim() != "null")
        const usersD = await fetchData()
        setUsers(usersD);
        setContactsPhone(contact);
        setLoading(false)
      } else {
        setLoading(false)
      }
    }
  };

  const deleteContact = async (contact: any) => {
    setLoading(true)
    const response  = await deletePersonalContact(contact.id)
    if (response?.status) {
      deleteAppContact(contact.id)
      setToast("Contact deleted successfully", "success")
      setConfirmOpen(false)
      setLoading(false)
    } else {
      setToast("Failed to delete contact", "error")
      setConfirmOpen(false)
      setLoading(false)
    }
  }


  return (
    <View className="relative pt-3 bg-grey dark:bg-dark px-4  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full flex-1 gap-y-4">

        <View className="w-full flex flex-row justify-start items-center gap-x-5">
          <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
          <CText className="text-[1.4rem]">Address Book</CText>
        </View>

        <View className="gap-y-4  overflow-hidden flex-1">
          <View className="flex flex-row justify-between items-center gap-x-2">
            <TouchableOpacity onPress={() => setShowContactOnHey(!showContactonHey)}>
              <CText style={{ fontFamily: "bold" }} className="p-4 text-primary text-[16px] text-start rounded-xl">Contacts on HeySolana</CText>
            </TouchableOpacity>

            <Buttons loading={isLoading}
              onPress={fetchContacts}
              type="primary" className="p-2 rounded-xl" text="Import Contact" />

          </View>


          {showContactonHey &&
            <View>
              <FlatList
                contentContainerStyle={{ paddingBottom: 50 }}
                getItemLayout={(data, index) => ({
                  length: 100,
                  offset: 100 * index,
                  index
                })}
                initialNumToRender={15}
                maxToRenderPerBatch={15}

                className=" rounded-xl gap-x-2  "
                data={contactsOnHeySolana}
                renderItem={(item: any) => {
                  return (
                    <View
                      className="bg-grey shadow dark:bg-accent  mb-2 flex flex-row justify-start gap-x-2 items-center p-3 rounded-xl "
                      key={item?.item?.walletAddress}
                    >
                      <View className="flex-1 flex flex-row justify-start items-center gap-x-2">
                        <View className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                          <CText>+</CText>
                        </View>
                        <View className="flex-1 flex-col  justify-start gap-x-4  items-start">
                          <CText className="text-[1.45rem]">{item?.item?.name}</CText>
                          <CText className="text-[1rem]">
                            {shortenPub(item?.item?.walletAddress || "")}
                          </CText>
                        </View>
                      </View>

                      {item?.item?.type === "personal" &&
                        <View className="rounded-full border bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                          <IconLibrary.delete />
                        </View>
                      }
                    </View>)
                }
                }
                keyExtractor={item => item.name}
              />
            </View>
          }

        </View>

        <View className="gap-y-4 overflow-hidden flex-1">
          <View className="flex flex-row justify-between items-center gap-x-2">

            <View>
              <CText style={{ fontFamily: "bold" }} className="p-4 text-primary text-[16px] text-start rounded-xl">Personal Contacts</CText>
            </View>

            <Buttons loading={isLoading}
              onPress={() => {setAddContactModal(true); setSelectedContact(null)}}
              type="primary" className="p-2 rounded-xl" text="Add Contact" />


          </View>



            <View>
              <FlatList
                contentContainerStyle={{ paddingBottom: 80 }}
                getItemLayout={(data, index) => ({
                  length: 100,
                  offset: 100 * index,
                  index
                })}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                className="rounded-xl gap-x-2  "
                data={personalContacts}
                renderItem={(item: any) => {
                  return (
                    <View
                      className="bg-grey shadow dark:bg-accent  mb-2 flex flex-row justify-start gap-x-2 items-center p-3 rounded-xl "
                      key={item?.item?.walletAddress}
                    >
                      <View className="flex-1 flex flex-row justify-start items-center gap-x-2">
                        <View className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                          <CText>+</CText>
                        </View>
                        <View className="flex-1 flex-col  justify-start gap-x-4  items-start">
                          <CText className="text-[1.45rem]">{item?.item?.name}</CText>
                          <CText className="text-[1rem]">
                            {shortenPub(item?.item?.walletAddress || "")}
                          </CText>
                        </View>
                      </View>

                      {item?.item?.type === "personal" &&
                        <View className="flex flex-row justify-start items-center gap-x-2">
                          <TouchableOpacity onPress={() => {
                            setAddContactModal(true)
                            setSelectedContact(item?.item)}} className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                            <IconLibrary.edit />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => {
                            setConfirmOpen(true)
                            setSelectedContact(item?.item)
                          }} className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                            <IconLibrary.delete />
                          </TouchableOpacity>
                        </View>

                      }
                    </View>)
                }
                }
                ListEmptyComponent={
                  <View className="flex-1 justify-center items-center">
                    <CText>No Contacts added yet!</CText>
                  </View>
                }
                keyExtractor={item => item.name}
              />
            </View>

        </View>



      </View>

      <ConfirmActionSheet
        title="Are you sure you want to delete this contact?"
        open={confirmOpen}
        close={setConfirmOpen}
        actionNo={() => {setConfirmOpen(false)}}
        actionYes={() => {
          deleteContact(selectedContact)
        }}
      />

      <AddContactSheet
        open={addContactModal}
        setOpen={setAddContactModal}
        data={selectedContact}
        setToast={(message, type) => setToast(message, type)}
      />

    
    </View>
  );
}

export default AddressBook


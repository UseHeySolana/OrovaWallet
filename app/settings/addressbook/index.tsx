import { useEffect, useState } from "react";
import { FlatList, Pressable, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import * as Contacts from 'expo-contacts';
import IconLibrary from "@/misc/helpers/icons";
import { fetchData } from "@/misc/helpers/db";
import Buttons from "@/components/ButtonComp";
import PhoneBook from "@/misc/store/phonebook";

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

  const [users, setUsers] = useState<any>([]);
  const [contactsPhone, setContactsPhone] = useState<any[]>([])
  const [contactsOnHeySolana, setContactsOnHeySolana] = useState<any[]>([])
  const { setLoading, isLoading } = AppSettings()
  const [showContactonHey, setShowContactOnHey] = useState(true)
  const [showContactonPhone, setShowContactOnPhone] = useState(false)
  const { contacts, addContact, addMultipleContacts } = PhoneBook()


  useEffect(() => {
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
  }, [contactsPhone, users])


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


  return (
    <View className="relative pt-3 bg-grey dark:bg-dark px-4  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full flex-1 gap-y-4">

        <View className="w-full flex flex-row justify-start items-center gap-x-5">
          <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
          <CText className="text-[1.4rem]">Address Book</CText>
        </View>

        <View className="gap-y-4">
          <TouchableOpacity onPress={() => setShowContactOnHey(!showContactonHey)}>
            <CText style={{ fontFamily: "bold" }} className="p-4 text-primary text-[16px] text-start rounded-xl bg-grey shadow dark:bg-accent">Contacts on HeySolana</CText>
          </TouchableOpacity>

          {showContactonHey &&
            <View>
              <FlatList
                getItemLayout={(data, index) => ({
                  length: 100,
                  offset: 100 * index,
                  index
                })}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                className="max-h-full rounded-xl gap-x-2  "
                data={contactsOnHeySolana}
                renderItem={(item: any) => {
                  return (
                    <View
                      className=" bg-grey shadow dark:bg-accent mb-2 flex flex-row justify-start gap-x-2 items-center p-3 rounded-xl "
                      key={item.item.walletAddress}
                    >
                      <View className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                        <CText>+</CText>
                      </View>
                      <View className="flex-1 flex-col  justify-start gap-x-4  items-start">
                        <CText className="text-[1.45rem]">{item.item.name}</CText>
                        <CText className="text-[1rem]">{item.item.walletAddress?.slice(0, 4) + '...' + item.item.walletAddress?.slice(-5)}</CText>

                      </View>
                    </View>)
                }
                }
                keyExtractor={item => item.name}
              />
            </View>
          }


          <Buttons loading={isLoading}
            onPress={fetchContacts} type="primary" text="Match Contacts" />

        </View>

        {/* <View className="gap-y-4 h-[550px]">
          <TouchableOpacity onPress={() => setShowContactOnPhone(!showContactonPhone)}>
            <CText style={{ fontFamily: "bold" }} className="p-4 text-primary text-[16px] text-start rounded-xl bg-grey shadow dark:bg-accent">Phone Contacts List</CText>
          </TouchableOpacity>
          {showContactonPhone &&
            <View>
              <FlatList
                className="rounded-xl bg-grey shadow dark:bg-accent p-4 pb-10 gap-x-2 "
                data={contactsPhone}
                renderItem={({ item }) => (<View
                  key={item.index}
                  className="flex flex-row justify-start gap-x-2 items-center p-2 mb-2 rounded-xl "
                >
                  <View className="rounded-full bg-white dark:bg-accent2 h-10 w-10 flex items-center  justify-center">
                    <CText>+</CText>
                  </View>
                  <CText className="text-[20px]">{item.name}</CText>
                </View>)}
                keyExtractor={item => item.id}
                ListEmptyComponent={() => {
                  return (
                    <Buttons loading={isLoading}
                      onPress={fetchContacts} type="primary" text="Fetch Contacts" />

                  )
                }}
              />
            </View>

          }
        </View> */}

      </View>




    </View>
  );
}

export default AddressBook

